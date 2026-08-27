/**
 * Discovery: turn a repo's `.sdd/` directory into an in-memory index.
 *
 * Two rules drive everything here, both from docs/DESIGN.md:
 *   1. Discovery over registration -- roles, flows and checklists are found by
 *      scanning directories. Dropping a file in is the whole install step.
 *   2. Overrides win -- `.sdd/overrides/<path>` shadows `.sdd/<path>`, so a
 *      team's local edits survive a `fleet-sdd init` upgrade.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, parseYaml, asList } from './yaml.mjs';

export const SDD_DIR = '.sdd';

export class SddError extends Error {}

/** Walk up from `start` looking for a directory containing `.sdd/`. */
export function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, SDD_DIR, 'config.yml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function requireRoot(start = process.cwd()) {
  const root = findRoot(start);
  if (!root) {
    throw new SddError(
      'No .sdd/ directory found in this repo or any parent.\n' +
        'Run `npx fleet-sdd init` first.'
    );
  }
  return root;
}

/**
 * Resolve a path inside `.sdd/`, preferring `.sdd/overrides/`.
 * Returns null when neither exists.
 */
export function resolveSddFile(root, relative) {
  const override = path.join(root, SDD_DIR, 'overrides', relative);
  if (fs.existsSync(override)) return override;
  const base = path.join(root, SDD_DIR, relative);
  return fs.existsSync(base) ? base : null;
}

function readMarkdownDir(root, relativeDir) {
  /** @type {Map<string, {id: string, file: string, data: object, body: string, overridden: boolean}>} */
  const found = new Map();

  // Base first, then overrides, so overrides replace by id.
  for (const [dir, overridden] of [
    [path.join(root, SDD_DIR, relativeDir), false],
    [path.join(root, SDD_DIR, 'overrides', relativeDir), true],
  ]) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      if (entry.name.startsWith('_') || entry.name === 'README.md') continue;

      const file = path.join(dir, entry.name);
      const raw = fs.readFileSync(file, 'utf8');
      let parsed;
      try {
        parsed = parseFrontmatter(raw);
      } catch (err) {
        throw new SddError(`${path.relative(root, file)}: ${err.message}`);
      }
      const id = parsed.data.id || entry.name.replace(/\.md$/, '');
      found.set(id, { id, file, data: parsed.data, body: parsed.body, overridden });
    }
  }

  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function loadConfig(root) {
  const file = resolveSddFile(root, 'config.yml');
  if (!file) throw new SddError('.sdd/config.yml is missing.');
  const config = parseYaml(fs.readFileSync(file, 'utf8')) || {};
  return {
    version: config.version ?? 1,
    specsDir: config.specsDir || 'docs/specs',
    defaultFlow: config.defaultFlow || 'feature',
    defaultTier: config.defaultTier || 'standard',
    tiers: config.tiers || {},
    tracker: config.tracker || {},
    adapters: config.adapters || {},
    _file: file,
    _raw: config,
  };
}

export function loadRoles(root) {
  return readMarkdownDir(root, 'roles').map((r) => ({
    id: r.id,
    name: r.data.name || r.id,
    owns: asList(r.data.owns),
    gates: asList(r.data.gates),
    reads: asList(r.data.reads),
    checklist: r.data.checklist || null,
    handoff: r.data.handoff || null,
    file: r.file,
    body: r.body,
    overridden: r.overridden,
  }));
}

export function loadFlows(root) {
  return readMarkdownDir(root, 'flows').map((f) => ({
    id: f.id,
    name: f.data.name || f.id,
    description: f.data.description || '',
    stages: (Array.isArray(f.data.stages) ? f.data.stages : []).map((s) => ({
      id: s?.id ?? '',
      artifact: s?.artifact ?? '',
      roles: asList(s?.roles),
      gates: asList(s?.gates),
      name: s?.name || s?.id || '',
    })),
    file: f.file,
    body: f.body,
    overridden: f.overridden,
  }));
}

/** Everything the commands need, loaded once. */
export function loadIndex(root) {
  const config = loadConfig(root);
  const roles = loadRoles(root);
  const flows = loadFlows(root);

  const roleById = new Map(roles.map((r) => [r.id, r]));

  /** gate id -> owning roles (a gate may legitimately have more than one) */
  const gateOwners = new Map();
  for (const role of roles) {
    for (const gate of role.gates) {
      if (!gateOwners.has(gate)) gateOwners.set(gate, []);
      gateOwners.get(gate).push(role);
    }
  }

  return {
    root,
    config,
    roles,
    flows,
    roleById,
    gateOwners,
    flowById: new Map(flows.map((f) => [f.id, f])),
  };
}

/** All gate ids a flow declares, in stage order. */
export function flowGates(flow) {
  return flow.stages.flatMap((s) => s.gates);
}

/**
 * The gates a feature must clear, given its tier. `requiredGates: all` (or an
 * unknown tier) means every gate the flow declares.
 */
export function requiredGatesFor(config, flow, tierName) {
  const all = flowGates(flow);
  const tier = config.tiers?.[tierName];
  const required = tier?.requiredGates;
  if (!tier || required === 'all' || required === null || required === undefined) return all;
  const wanted = new Set(asList(required));
  return all.filter((g) => wanted.has(g));
}

/**
 * The artifact files a feature must contain, given its tier.
 *
 * Derived from the flow rather than listed in the tier: an artifact is required
 * when the stage that produces it has at least one required gate. That keeps
 * tiers flow-agnostic -- `tiny` means "fewer gates", and the artifact set
 * follows automatically instead of having to be restated per flow.
 *
 * `extraArtifacts` covers files no stage produces, such as a decision record.
 */
export function requiredArtifactsFor(config, flow, tierName) {
  const required = new Set(requiredGatesFor(config, flow, tierName));
  const artifacts = [];

  for (const stage of flow.stages) {
    if (!stage.artifact || artifacts.includes(stage.artifact)) continue;
    if (stage.gates.some((gate) => required.has(gate))) artifacts.push(stage.artifact);
  }

  for (const extra of asList(config.tiers?.[tierName]?.extraArtifacts)) {
    if (!artifacts.includes(extra)) artifacts.push(extra);
  }

  return artifacts;
}

/** List feature directories under `specsDir`, numerically sorted. */
export function listFeatures(root, config) {
  const dir = path.join(root, config.specsDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'gates.yml')))
    .map((e) => ({ id: e.name, dir: path.join(dir, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

const CURRENT_FILE = path.join(SDD_DIR, '.current');

export function readCurrentFeature(root) {
  const file = path.join(root, CURRENT_FILE);
  if (!fs.existsSync(file)) return null;
  const value = fs.readFileSync(file, 'utf8').trim();
  return value || null;
}

export function writeCurrentFeature(root, featureId) {
  fs.writeFileSync(path.join(root, CURRENT_FILE), `${featureId}\n`, 'utf8');
}

/**
 * Pick the feature to act on: explicit argument, then the last one created,
 * then the only one that exists. Anything else is an error listing the options
 * -- guessing here would be worse than asking.
 */
export function resolveFeature(root, config, hint) {
  const features = listFeatures(root, config);
  if (features.length === 0) {
    throw new SddError(
      `No features found in ${config.specsDir}/.\n` +
        'Create one with `fleet-sdd new "Some capability"`.'
    );
  }

  if (hint) {
    const needle = String(hint).toLowerCase();
    const exact = features.find((f) => f.id.toLowerCase() === needle);
    if (exact) return exact;
    const matches = features.filter((f) => f.id.toLowerCase().includes(needle));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new SddError(
        `"${hint}" matches more than one feature:\n` + matches.map((f) => `  ${f.id}`).join('\n')
      );
    }
    throw new SddError(
      `No feature matching "${hint}". Available:\n` + features.map((f) => `  ${f.id}`).join('\n')
    );
  }

  const current = readCurrentFeature(root);
  if (current) {
    const match = features.find((f) => f.id === current);
    if (match) return match;
  }

  if (features.length === 1) return features[0];

  throw new SddError(
    'Several features exist -- name the one you mean, e.g. `fleet-sdd next 002`:\n' +
      features.map((f) => `  ${f.id}`).join('\n')
  );
}
