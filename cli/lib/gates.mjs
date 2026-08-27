/**
 * The gate engine: read and write `gates.yml`, and answer the only question
 * most people ever ask -- "what is next and who owns it?"
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseYaml, stringifyYaml } from './yaml.mjs';
import { SddError, requiredGatesFor } from './discover.mjs';

export const STATUSES = ['pending', 'in-review', 'approved', 'changes-requested', 'waived'];

/** Statuses that let the flow move past a gate. */
export const CLEARED = new Set(['approved', 'waived']);

export const VERDICTS = {
  approve: 'approved',
  'request-changes': 'changes-requested',
  review: 'in-review',
  waive: 'waived',
  reset: 'pending',
};

export function gatesPath(featureDir) {
  return path.join(featureDir, 'gates.yml');
}

export function readGates(featureDir) {
  const file = gatesPath(featureDir);
  if (!fs.existsSync(file)) {
    throw new SddError(`${file} is missing -- this does not look like an SDD feature directory.`);
  }
  let data;
  try {
    data = parseYaml(fs.readFileSync(file, 'utf8')) || {};
  } catch (err) {
    throw new SddError(`${file}: ${err.message}`);
  }
  if (!data.gates || typeof data.gates !== 'object') data.gates = {};
  return data;
}

/**
 * Write gates.yml in a stable key order so diffs show only real changes.
 * Gate order follows the flow, not insertion order.
 */
export function writeGates(featureDir, ledger, gateOrder = []) {
  const head = {};
  for (const key of ['feature', 'title', 'flow', 'tier', 'created', 'owner']) {
    if (ledger[key] !== undefined && ledger[key] !== null) head[key] = ledger[key];
  }
  for (const key of Object.keys(ledger)) {
    if (key === 'gates' || key in head) continue;
    head[key] = ledger[key];
  }

  const ordered = {};
  const seen = new Set();
  for (const gate of gateOrder) {
    if (gate in ledger.gates) {
      ordered[gate] = normaliseEntry(ledger.gates[gate]);
      seen.add(gate);
    }
  }
  for (const gate of Object.keys(ledger.gates)) {
    if (!seen.has(gate)) ordered[gate] = normaliseEntry(ledger.gates[gate]);
  }

  const text = stringifyYaml({ ...head, gates: ordered });
  fs.writeFileSync(gatesPath(featureDir), text, 'utf8');
}

function normaliseEntry(entry) {
  if (entry === null || entry === undefined) return { status: 'pending' };
  if (typeof entry === 'string') return { status: entry };
  const out = { status: entry.status || 'pending' };
  for (const key of ['by', 'at', 'note', 'reason']) {
    if (entry[key] !== undefined && entry[key] !== null && entry[key] !== '') out[key] = entry[key];
  }
  for (const key of Object.keys(entry)) {
    if (!(key in out) && entry[key] !== null && entry[key] !== undefined) out[key] = entry[key];
  }
  return out;
}

export function gateStatus(ledger, gateId) {
  return normaliseEntry(ledger.gates?.[gateId]).status;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Best-effort identity for a sign-off: explicit flag, env, then git config. */
export function currentUser(explicit) {
  if (explicit) return explicit;
  if (process.env.SDD_USER) return process.env.SDD_USER;
  if (process.env.GIT_AUTHOR_EMAIL) return process.env.GIT_AUTHOR_EMAIL;
  try {
    const email = execFileSync('git', ['config', '--get', 'user.email'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (email) return email;
  } catch {
    /* git absent or no config -- fall through */
  }
  return 'unknown';
}

/**
 * Work out where a feature stands.
 *
 * Returns the first stage that still has uncleared required gates, along with
 * every blocking gate and its owning roles. Also reports gates cleared out of
 * order, which usually means someone signed off before the inputs were ready.
 */
export function computeNext(index, feature) {
  const ledger = readGates(feature.dir);
  const flowId = ledger.flow || index.config.defaultFlow;
  const flow = index.flowById.get(flowId);
  if (!flow) {
    throw new SddError(
      `${feature.id}: flow "${flowId}" not found in .sdd/flows/. ` +
        `Available: ${[...index.flowById.keys()].join(', ') || '(none)'}`
    );
  }

  const tier = ledger.tier || index.config.defaultTier;
  const required = new Set(requiredGatesFor(index.config, flow, tier));

  const stages = flow.stages.map((stage) => {
    const gates = stage.gates
      .filter((g) => required.has(g))
      .map((g) => ({
        id: g,
        status: gateStatus(ledger, g),
        entry: normaliseEntry(ledger.gates?.[g]),
        owners: index.gateOwners.get(g) || [],
      }));
    const outstanding = gates.filter((g) => !CLEARED.has(g.status));
    return { ...stage, gates, outstanding, complete: gates.length > 0 && outstanding.length === 0 };
  });

  const active = stages.find((s) => s.outstanding.length > 0) || null;

  // Anything cleared in a later stage while an earlier stage is still open.
  const outOfOrder = [];
  if (active) {
    const activeIndex = stages.indexOf(active);
    for (const stage of stages.slice(activeIndex + 1)) {
      for (const gate of stage.gates) {
        if (CLEARED.has(gate.status)) outOfOrder.push({ stage: stage.id, gate: gate.id });
      }
    }
  }

  const totalRequired = stages.reduce((n, s) => n + s.gates.length, 0);
  const totalCleared = stages.reduce(
    (n, s) => n + s.gates.filter((g) => CLEARED.has(g.status)).length,
    0
  );

  return {
    feature,
    ledger,
    flow,
    tier,
    stages,
    active,
    outOfOrder,
    done: active === null && totalRequired > 0,
    progress: { cleared: totalCleared, total: totalRequired },
  };
}
