#!/usr/bin/env node
/**
 * Fleet SDD command line.
 *
 * This file only globs, validates and reports. Every prompt, checklist and
 * rule lives in `.sdd/*.md` so a team can change how the framework behaves
 * without touching code -- see docs/DESIGN.md, "The CLI never owns semantics".
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SddError,
  findRoot,
  requireRoot,
  loadIndex,
  listFeatures,
  resolveFeature,
  resolveSddFile,
  requiredGatesFor,
  requiredArtifactsFor,
  writeCurrentFeature,
  readCurrentFeature,
} from './lib/discover.mjs';
import {
  readGates,
  writeGates,
  computeNext,
  currentUser,
  today,
  VERDICTS,
  CLEARED,
  gateStatus,
} from './lib/gates.mjs';
import { checkAll, PLACEHOLDER } from './lib/check.mjs';
import { install, ADAPTERS, readManifest, KIT_DIR, sha256, walk } from './lib/install.mjs';
import { loadAdapter, listAdapters } from './lib/adapters/resolve.mjs';

const VERSION = '1.0.0';
const BOOL_FLAGS = new Set([
  'dry-run',
  'apply',
  'all',
  'help',
  'version',
  'json',
  'force',
  'list',
]);

/* ------------------------------------------------------------------ output */

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColour ? `[${code}m${s}[0m` : String(s));
const bold = paint('1');
const dim = paint('2');
const red = paint('31');
const green = paint('32');
const yellow = paint('33');
const cyan = paint('36');

const out = (line = '') => process.stdout.write(`${line}\n`);

const STATUS_STYLE = {
  approved: green,
  waived: green,
  pending: dim,
  'in-review': cyan,
  'changes-requested': yellow,
};

function statusLabel(status) {
  return (STATUS_STYLE[status] || ((s) => s))(status);
}

function posix(p) {
  return p.split(path.sep).join('/');
}

/* -------------------------------------------------------------- arg parsing */

function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg === '-m') {
      flags.message = argv[++i];
      continue;
    }
    if (arg === '-h') {
      flags.help = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const name = arg.slice(2);
      if (BOOL_FLAGS.has(name)) {
        flags[name] = true;
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) flags[name] = argv[++i];
        else flags[name] = true;
      }
      continue;
    }
    positional.push(arg);
  }

  return { flags, positional };
}

/* -------------------------------------------------------------------- init */

function cmdInit({ flags }) {
  const target = path.resolve(flags.into ? String(flags.into) : process.cwd());
  const requested = flags.adapters ? String(flags.adapters).split(',').map((a) => a.trim()) : ['claude'];
  const adapters = requested.filter((a) => a && a !== 'none');

  for (const adapter of adapters) {
    if (!ADAPTERS[adapter]) {
      throw new SddError(
        `Unknown adapter "${adapter}". Available: ${Object.keys(ADAPTERS).join(', ')}, none`
      );
    }
  }

  if (!fs.existsSync(KIT_DIR)) {
    throw new SddError(`Kit directory not found at ${KIT_DIR}. Is this a complete fleet-sdd install?`);
  }

  const fresh = !fs.existsSync(path.join(target, '.sdd', 'config.yml'));
  const dryRun = Boolean(flags['dry-run']);

  const report = install(target, {
    adapters,
    project: flags.project ? String(flags.project) : undefined,
    dryRun,
  });

  out();
  out(bold(`Fleet SDD ${VERSION} ${fresh ? 'installed into' : 'synced with'} ${posix(target)}`));
  if (dryRun) out(yellow('  (dry run -- nothing was written)'));
  out();
  out(`  ${green('created')}   ${report.created.length} file(s)`);
  out(`  ${cyan('updated')}   ${report.updated.length} file(s)`);
  out(`  ${dim('unchanged')} ${report.unchanged.length} file(s)`);
  if (adapters.length) out(`  ${dim('adapters')}  ${adapters.join(', ')}`);

  for (const block of report.blocks) {
    if (block.outcome !== 'unchanged') out(`  ${dim('block')}     ${block.rel} (${block.outcome})`);
  }

  if (report.conflicts.length) {
    out();
    out(yellow(`  ${report.conflicts.length} file(s) you edited locally were left alone.`));
    out(dim('  The new version sits next to each one as <name>.new -- merge what you want:'));
    for (const rel of report.conflicts.slice(0, 20)) out(`    ${posix(rel)}`);
    if (report.conflicts.length > 20) out(dim(`    ... and ${report.conflicts.length - 20} more`));
    out(dim('  Prefer .sdd/overrides/<path> for lasting changes -- overrides are never overwritten.'));
  }

  out();
  if (fresh) {
    out(bold('Next'));
    out(`  1. Edit ${cyan('.sdd/constitution.md')} -- your non-negotiables.`);
    out(`  2. ${cyan('npx fleet-sdd new "Your first capability"')}`);
    out(`  3. ${cyan('npx fleet-sdd next')}  ${dim('<- the only command anyone has to remember')}`);
  } else {
    out(`Run ${cyan('npx fleet-sdd check')} to confirm everything still validates.`);
  }
  out();
  return 0;
}

/* --------------------------------------------------------------------- new */

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function nextFeatureNumber(root, config) {
  const existing = listFeatures(root, config);
  let max = 0;
  for (const feature of existing) {
    const match = /^(\d+)/.exec(feature.id);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return String(max + 1).padStart(3, '0');
}

function renderTemplate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? String(vars[key]) : m));
}

function cmdNew({ flags, positional }) {
  const root = requireRoot();
  const index = loadIndex(root);
  const { config } = index;

  const title = positional.join(' ').trim();
  if (!title) throw new SddError('Give the feature a title, e.g. `fleet-sdd new "Driver scorecard"`.');

  const flowId = String(flags.flow || config.defaultFlow);
  const flow = index.flowById.get(flowId);
  if (!flow) {
    throw new SddError(
      `Unknown flow "${flowId}". Available: ${[...index.flowById.keys()].join(', ') || '(none)'}`
    );
  }

  const tier = String(flags.tier || config.defaultTier);
  if (!config.tiers?.[tier]) {
    throw new SddError(
      `Unknown tier "${tier}". Available: ${Object.keys(config.tiers || {}).join(', ') || '(none)'}`
    );
  }

  const featureId = flags.id ? String(flags.id) : `${nextFeatureNumber(root, config)}-${slugify(title)}`;
  const featureDir = path.join(root, config.specsDir, featureId);
  if (fs.existsSync(featureDir)) throw new SddError(`${posix(path.relative(root, featureDir))} already exists.`);

  const gates = requiredGatesFor(config, flow, tier);
  const artifacts = requiredArtifactsFor(config, flow, tier);
  const vars = {
    FEATURE_ID: featureId,
    TITLE: title,
    DATE: today(),
    FLOW: flowId,
    TIER: tier,
    OWNER: currentUser(flags.by ? String(flags.by) : null),
    PLACEHOLDER,
  };

  fs.mkdirSync(featureDir, { recursive: true });

  const written = [];
  for (const artifact of artifacts) {
    const template = resolveSddFile(root, path.join('templates', artifact));
    const body = template
      ? renderTemplate(fs.readFileSync(template, 'utf8'), vars)
      : `# ${title} -- ${artifact}\n\n${PLACEHOLDER}: no template found at .sdd/templates/${artifact}.\n`;
    fs.writeFileSync(path.join(featureDir, artifact), body.replace(/\r\n/g, '\n'), 'utf8');
    written.push(artifact);
  }

  const ledger = {
    feature: featureId,
    title,
    flow: flowId,
    tier,
    created: vars.DATE,
    owner: vars.OWNER,
    gates: Object.fromEntries(gates.map((g) => [g, { status: 'pending' }])),
  };
  writeGates(featureDir, ledger, gates);
  written.push('gates.yml');

  writeCurrentFeature(root, featureId);

  out();
  out(bold(`Created ${posix(path.relative(root, featureDir))}`));
  out(`  flow ${cyan(flowId)}   tier ${cyan(tier)}   gates ${cyan(String(gates.length))}`);
  for (const file of written) out(`  ${green('+')} ${file}`);
  out();
  out(`Now run ${cyan('fleet-sdd next')} (or ${cyan('/sdd:next')} in Claude Code).`);
  out();
  return 0;
}

/* -------------------------------------------------------------------- next */

function cmdNext({ flags, positional }) {
  const root = requireRoot();
  const index = loadIndex(root);
  const feature = resolveFeature(root, index.config, positional[0] || flags.feature);
  const state = computeNext(index, feature);
  const relDir = posix(path.relative(root, feature.dir));

  out();
  out(`${bold(feature.id)}${state.ledger.title ? ` ${dim('--')} ${state.ledger.title}` : ''}`);
  out(
    `${dim('flow')} ${state.flow.id}   ${dim('tier')} ${state.tier}   ` +
      `${dim('gates')} ${state.progress.cleared}/${state.progress.total} cleared`
  );

  if (state.done) {
    out();
    out(green('All required gates are cleared. This feature is done.'));
    out(dim(`Evidence: ${relDir}/evidence.md`));
    out();
    return 0;
  }

  const stage = state.active;
  out();
  out(`${bold('Stage')}    ${cyan(stage.id)}${stage.name && stage.name !== stage.id ? ` ${dim('--')} ${stage.name}` : ''}`);
  out(`${bold('Artifact')} ${relDir}/${stage.artifact}`);
  out();
  out(bold(`Blocked on ${stage.outstanding.length} gate(s):`));
  out();

  for (const gate of stage.outstanding) {
    const owners = gate.owners.length
      ? gate.owners.map((o) => `${o.name} (${o.id})`).join(', ')
      : red('UNOWNED -- no role in .sdd/roles/ claims this gate');
    // Pad before colouring -- ANSI codes count toward string length.
    const status = (STATUS_STYLE[gate.status] || ((s) => s))(gate.status.padEnd(18));
    out(`  ${bold(gate.id.padEnd(26))} ${status} ${owners}`);
    if (gate.entry.note) out(`    ${dim('note')}      ${gate.entry.note}`);
    for (const owner of gate.owners) {
      if (owner.checklist) out(`    ${dim('checklist')} .sdd/${owner.checklist}`);
    }
  }

  const roleIds = [...new Set(stage.outstanding.flatMap((g) => g.owners.map((o) => o.id)))];
  out();
  out(bold('Do this next'));
  if (roleIds.length) {
    for (const roleId of roleIds) {
      out(`  ${cyan(`/sdd:role ${roleId}`)}${dim(`   or read .sdd/roles/${roleId}.md and work on ${stage.artifact}`)}`);
    }
  }
  out(`  ${cyan(`fleet-sdd gate ${stage.outstanding[0].id} approve -m "..."`)} ${dim('once the work is signed off')}`);

  if (state.outOfOrder.length) {
    out();
    out(yellow('Signed off ahead of this stage (worth a second look):'));
    for (const item of state.outOfOrder) out(`  ${item.gate} ${dim(`in stage ${item.stage}`)}`);
  }

  out();
  return 0;
}

/* -------------------------------------------------------------------- gate */

function cmdGate({ flags, positional }) {
  const root = requireRoot();
  const index = loadIndex(root);
  const [gateId, verdictArg] = positional;

  if (!gateId || !verdictArg) {
    throw new SddError(
      'Usage: fleet-sdd gate <gate-id> <approve|request-changes|review|waive|reset> [-m "note"]'
    );
  }

  const status = VERDICTS[verdictArg];
  if (!status) {
    throw new SddError(
      `Unknown verdict "${verdictArg}". Use one of: ${Object.keys(VERDICTS).join(', ')}`
    );
  }

  const feature = resolveFeature(root, index.config, flags.feature);
  const ledger = readGates(feature.dir);
  const flow = index.flowById.get(ledger.flow || index.config.defaultFlow);
  if (!flow) throw new SddError(`Feature ${feature.id} references unknown flow "${ledger.flow}".`);

  const known = flow.stages.flatMap((s) => s.gates);
  if (!known.includes(gateId)) {
    throw new SddError(
      `Flow "${flow.id}" declares no gate "${gateId}". Gates in this flow:\n` +
        known.map((g) => `  ${g}`).join('\n')
    );
  }

  const note = flags.message ? String(flags.message) : null;
  if (status === 'waived' && !note) {
    throw new SddError('Waiving a gate needs a reason: `fleet-sdd gate <id> waive -m "why"`.');
  }

  const previous = gateStatus(ledger, gateId);
  const entry = { status };
  if (status !== 'pending') {
    entry.by = currentUser(flags.by ? String(flags.by) : null);
    entry.at = today();
    if (status === 'waived') entry.reason = note;
    else if (note) entry.note = note;
  }

  ledger.gates[gateId] = entry;
  writeGates(feature.dir, ledger, known);

  out();
  out(`${bold(gateId)}  ${dim(previous)} ${dim('->')} ${statusLabel(status)}`);
  if (entry.by) out(`${dim('by')} ${entry.by}  ${dim('on')} ${entry.at}`);
  if (note) out(`${dim('note')} ${note}`);
  out();

  // Signing off is exactly when you want to know what opens up next.
  return cmdNext({ flags: { feature: feature.id }, positional: [] });
}

/* ------------------------------------------------------------------- check */

function cmdCheck({ flags, positional }) {
  const root = requireRoot();
  const index = loadIndex(root);

  let hint = positional[0] || flags.feature || null;
  if (hint) hint = resolveFeature(root, index.config, hint).id;

  const { findings, featureCount } = checkAll(index, hint);

  out();
  for (const finding of findings.errors) out(`${red('error')}   ${finding.where}: ${finding.message}`);
  for (const finding of findings.warnings) out(`${yellow('warn')}    ${finding.where}: ${finding.message}`);
  if (findings.errors.length || findings.warnings.length) out();

  const scope = `${index.roles.length} role(s), ${index.flows.length} flow(s), ${featureCount} feature(s)`;
  if (findings.ok) {
    out(green(`check passed`) + dim(`  -- ${scope}, ${findings.warnings.length} warning(s)`));
    out();
    return 0;
  }

  out(red(`check failed`) + dim(`  -- ${findings.errors.length} error(s) across ${scope}`));
  out();
  return 1;
}

/* ------------------------------------------------------------------- roles */

function cmdRoles({ positional }) {
  const root = requireRoot();
  const index = loadIndex(root);

  if (positional[0]) {
    const role = index.roleById.get(positional[0]);
    if (!role) {
      throw new SddError(
        `No role "${positional[0]}". Known roles:\n` + index.roles.map((r) => `  ${r.id}`).join('\n')
      );
    }
    out();
    out(bold(`${role.name} (${role.id})`));
    if (role.gates.length) out(`${dim('gates')}     ${role.gates.join(', ')}`);
    if (role.owns.length) out(`${dim('owns')}      ${role.owns.join(', ')}`);
    if (role.reads.length) out(`${dim('reads')}     ${role.reads.join(', ')}`);
    if (role.checklist) out(`${dim('checklist')} .sdd/${role.checklist}`);
    if (role.handoff) out(`${dim('handoff')}   ${role.handoff}`);
    out(`${dim('file')}      ${posix(path.relative(root, role.file))}`);
    out();
    out(role.body.trim());
    out();
    return 0;
  }

  out();
  out(bold(`${index.roles.length} role(s) discovered in .sdd/roles/`));
  out();
  for (const role of index.roles) {
    const flag = role.overridden ? yellow(' [override]') : '';
    out(`  ${bold(role.id.padEnd(24))} ${role.name}${flag}`);
    out(`  ${' '.repeat(24)} ${dim(role.gates.join(', ') || 'owns no gates')}`);
  }
  out();
  out(dim('Add a role by dropping a .md file in .sdd/roles/ -- no registration needed.'));
  out(dim('See .sdd/EXTENDING.md.'));
  out();
  return 0;
}

/* ------------------------------------------------------------------ status */

function cmdStatus() {
  const root = requireRoot();
  const index = loadIndex(root);
  const features = listFeatures(root, index.config);

  if (features.length === 0) {
    out();
    out(`No features yet in ${index.config.specsDir}/.`);
    out(`Create one with ${cyan('fleet-sdd new "Some capability"')}.`);
    out();
    return 0;
  }

  const current = readCurrentFeature(root);
  out();
  out(bold(`${features.length} feature(s) in ${index.config.specsDir}/`));
  out();
  out(dim(`  ${'FEATURE'.padEnd(34)}${'STAGE'.padEnd(10)}${'GATES'.padEnd(8)}BLOCKED ON`));

  for (const feature of features) {
    let state;
    try {
      state = computeNext(index, feature);
    } catch (err) {
      out(`  ${feature.id.padEnd(34)}${red('error')}     ${dim(err.message.split('\n')[0])}`);
      continue;
    }

    const marker = feature.id === current ? cyan('*') : ' ';
    const stage = state.done ? green('done'.padEnd(10)) : state.active.id.padEnd(10);
    const progress = `${state.progress.cleared}/${state.progress.total}`;
    const blocked = state.done
      ? ''
      : state.active.outstanding
          .map((g) => g.id)
          .slice(0, 2)
          .join(', ') + (state.active.outstanding.length > 2 ? ', ...' : '');

    out(`${marker} ${feature.id.padEnd(34)}${stage}${progress.padEnd(8)}${dim(blocked)}`);
  }

  out();
  if (current) out(dim(`* current feature (set by \`fleet-sdd new\`; override with a name argument)`));
  out();
  return 0;
}

/* ------------------------------------------------------------------ doctor */

function cmdDoctor() {
  const root = findRoot();
  out();
  out(bold(`Fleet SDD ${VERSION} doctor`));
  out();
  out(`  ${dim('node')}       ${process.version}`);
  out(`  ${dim('kit')}        ${fs.existsSync(KIT_DIR) ? green('found') : red('missing')} ${dim(posix(KIT_DIR))}`);

  if (!root) {
    out(`  ${dim('repo')}       ${yellow('no .sdd/ found here or above')}`);
    out();
    out(`Run ${cyan('npx fleet-sdd init')} in your product repo.`);
    out();
    return 1;
  }

  out(`  ${dim('repo')}       ${posix(root)}`);

  const index = loadIndex(root);
  out(`  ${dim('roles')}      ${index.roles.length}`);
  out(`  ${dim('flows')}      ${index.flows.length} ${dim(`(${[...index.flowById.keys()].join(', ')})`)}`);
  out(`  ${dim('specs')}      ${listFeatures(root, index.config).length} in ${index.config.specsDir}/`);

  const manifest = readManifest(root);
  const tracked = Object.keys(manifest.files);
  let drifted = 0;
  let missing = 0;
  for (const rel of tracked) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) missing++;
    else if (sha256(fs.readFileSync(file, 'utf8')) !== manifest.files[rel]) drifted++;
  }
  out(`  ${dim('manifest')}   ${tracked.length} tracked, ${drifted} locally edited, ${missing} missing`);

  const overrides = path.join(root, '.sdd', 'overrides');
  if (fs.existsSync(overrides)) {
    const files = walk(overrides);
    out(`  ${dim('overrides')}  ${files.length} file(s) shadowing the shipped kit`);
    for (const file of files.slice(0, 10)) out(`             ${dim(posix(file))}`);
  } else {
    out(`  ${dim('overrides')}  ${dim('none')}`);
  }

  for (const [name, spec] of Object.entries(ADAPTERS)) {
    const dir = path.join(root, spec.to);
    out(`  ${dim(name.padEnd(10))} ${fs.existsSync(dir) ? green('installed') : dim('not installed')}`);
  }

  const stale = [];
  const scan = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (entry.name.endsWith('.new')) stale.push(posix(path.relative(root, full)));
    }
  };
  scan(path.join(root, '.sdd'));
  scan(path.join(root, '.claude'));

  if (stale.length) {
    out();
    out(yellow(`  ${stale.length} unmerged upgrade file(s):`));
    for (const file of stale.slice(0, 10)) out(`    ${file}`);
  }

  out();
  out(`Run ${cyan('fleet-sdd check')} for content validation.`);
  out();
  return 0;
}

/* -------------------------------------------------------------------- sync */

async function cmdSync({ flags, positional }) {
  const root = requireRoot();
  const index = loadIndex(root);
  const provider = positional[0] || index.config.tracker?.provider || 'jira';

  if (flags.list) {
    const { shipped, local } = listAdapters(root);
    out();
    out(bold('Adapters'));
    for (const name of shipped) out(`  ${name.padEnd(16)} ${dim('shipped')}`);
    for (const name of local) out(`  ${name.padEnd(16)} ${cyan('.sdd/adapters/')}`);
    out();
    out(dim('Add one by creating .sdd/adapters/<name>.mjs -- see docs/authoring-roles.md.'));
    out();
    return 0;
  }

  const feature = resolveFeature(root, index.config, flags.feature || positional[1]);
  const { syncTracker, local } = await loadAdapter(root, provider);

  // Dry run is the default: pushing to a tracker is an outward-facing action.
  const apply = Boolean(flags.apply) && !flags['dry-run'];

  if (local) out(dim(`using .sdd/adapters/${provider}.mjs`));

  return syncTracker({
    index,
    feature,
    provider,
    apply,
    out,
    colours: { bold, dim, cyan, green, yellow, red },
  });
}

/* -------------------------------------------------------------------- help */

const HELP = `
${bold('fleet-sdd')} ${dim(VERSION)} -- spec-driven development for multi-role teams

${bold('Everyday')}
  fleet-sdd next [feature]              What is next, and who owns it
  fleet-sdd new "<title>"               Scaffold a feature (--tier, --flow)
  fleet-sdd gate <id> <verdict> -m "…"  approve | request-changes | review | waive | reset
  fleet-sdd check [feature]             Validate artifacts and gates (exit 1 on error)
  fleet-sdd status                      Every feature, its stage and blockers

${bold('Setup')}
  fleet-sdd init                        Install the kit here (--adapters=claude,cursor,copilot)
  fleet-sdd roles [id]                  List discovered roles, or print one
  fleet-sdd doctor                      Install health, local edits, unmerged upgrades
  fleet-sdd sync [provider] [--apply]   Push tasks.md to a tracker (dry run by default)
  fleet-sdd sync --list                 Adapters available here, shipped and local

${bold('Ideas')}
  Three concepts only: ${cyan('artifacts')} (the shared truth), ${cyan('roles')} (lenses on them),
  ${cyan('flows')} (ordered stages with gates). Everything is a Markdown file under .sdd/.
  Add a role by dropping a file in .sdd/roles/ -- see .sdd/EXTENDING.md.
`;

/* ---------------------------------------------------------------- dispatch */

const COMMANDS = {
  init: cmdInit,
  new: cmdNew,
  next: cmdNext,
  gate: cmdGate,
  check: cmdCheck,
  roles: cmdRoles,
  role: cmdRoles,
  status: cmdStatus,
  doctor: cmdDoctor,
  sync: cmdSync,
};

function main(argv) {
  const { flags, positional } = parseArgs(argv);
  const command = positional.shift();

  if (flags.version || command === 'version') {
    out(VERSION);
    return 0;
  }
  if (!command || command === 'help' || flags.help) {
    out(HELP);
    return command && command !== 'help' ? 1 : 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    out(red(`Unknown command "${command}".`));
    out(HELP);
    return 1;
  }

  return handler({ flags, positional }) ?? 0;
}

function fail(err) {
  if (!(err instanceof SddError)) throw err;
  out();
  out(`${red('error')} ${err.message}`);
  out();
  return 1;
}

try {
  const result = main(process.argv.slice(2));
  // `sync --apply` is the only asynchronous path.
  if (result instanceof Promise) {
    result.then(
      (code) => {
        process.exitCode = code ?? 0;
      },
      (err) => {
        process.exitCode = fail(err);
      }
    );
  } else {
    process.exitCode = result;
  }
} catch (err) {
  process.exitCode = fail(err);
}
