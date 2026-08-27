#!/usr/bin/env node
/**
 * Zero-dependency test suite: `npm test`.
 *
 * Every test drives the CLI the way a person would -- a real install into a
 * temporary directory, then real commands. Nothing is mocked, because the thing
 * most likely to break is the interaction between the parser, the ledger and
 * the filesystem, and a mock would hide exactly that.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseYaml, stringifyYaml, parseFrontmatter } from '../cli/lib/yaml.mjs';
import { parseTasks } from '../cli/lib/adapters/jira.mjs';
import { renderAll } from '../docs/diagrams/build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'cli', 'sdd.mjs');

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ok   ${name}\n`);
  } catch (err) {
    failures.push({ name, err });
    process.stdout.write(`  FAIL ${name}\n       ${err.message.split('\n')[0]}\n`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message || 'not equal'}\n  actual:   ${a}\n  expected: ${b}`);
}

function includes(haystack, needle, message) {
  if (!String(haystack).includes(needle)) {
    throw new Error(`${message || 'missing text'}: expected to find ${JSON.stringify(needle)}`);
  }
}

/** Run the CLI in `cwd`. Returns `{ status, output }` -- never throws on exit 1. */
function sdd(cwd, args) {
  try {
    const output = execFileSync(process.execPath, [CLI, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', SDD_USER: 'tester@example.com' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output };
  } catch (err) {
    return { status: err.status ?? 1, output: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-sdd-test-'));
  return dir;
}

/* ------------------------------------------------------------- YAML subset */

process.stdout.write('\nyaml\n');

test('parses block sequences of maps', () => {
  const parsed = parseYaml(`
stages:
  - id: frame
    roles: [pm, ux]
  - id: shape
    roles:
      - architect
      - tech-lead
`);
  equal(parsed.stages.length, 2);
  equal(parsed.stages[0].roles, ['pm', 'ux']);
  equal(parsed.stages[1].roles, ['architect', 'tech-lead']);
});

test('parses a sequence at the same indent as its key', () => {
  equal(parseYaml('artifacts:\n- spec.md\n- design.md\ntier: tiny'), {
    artifacts: ['spec.md', 'design.md'],
    tier: 'tiny',
  });
});

test('parses folded and literal block scalars', () => {
  const parsed = parseYaml(`
folded: >-
  one
  two
literal: |
  line one
  line two
after: kept
`);
  equal(parsed.folded, 'one two');
  equal(parsed.literal, 'line one\nline two');
  equal(parsed.after, 'kept', 'keys after a block scalar must still parse');
});

test('keeps # inside quotes and strips real comments', () => {
  const parsed = parseYaml('a: "has # hash"   # a comment\nb: plain');
  equal(parsed.a, 'has # hash');
  equal(parsed.b, 'plain');
});

test('joins multi-line flow collections', () => {
  equal(parseYaml('gates: [one,\n  two,\n  three]').gates, ['one', 'two', 'three']);
});

test('handles empty collections and nulls', () => {
  equal(parseYaml('a: []\nb: {}\nc:\nd: ~'), { a: [], b: {}, c: null, d: null });
});

test('round-trips a gate ledger through stringify', () => {
  const ledger = {
    feature: '001-x',
    gates: {
      'spec.product': { status: 'approved', by: 'a@b.c', note: 'has: a colon' },
      'design.security': { status: 'pending' },
    },
  };
  equal(parseYaml(stringifyYaml(ledger)), ledger);
});

test('splits front matter from body', () => {
  const { data, body } = parseFrontmatter('---\nid: x\ngates: [a]\n---\n## Body\ntext\n');
  equal(data, { id: 'x', gates: ['a'] });
  includes(body, '## Body');
});

test('treats a file with no front matter as all body', () => {
  const { data, body } = parseFrontmatter('# Just markdown\n');
  equal(data, {});
  includes(body, '# Just markdown');
});

/* ------------------------------------------------------- install / upgrade */

process.stdout.write('\ninstall\n');

const repo = sandbox();

test('init installs the kit and the shipped framework validates', () => {
  const init = sdd(repo, ['init']);
  equal(init.status, 0, init.output);
  assert(fs.existsSync(path.join(repo, '.sdd', 'config.yml')), '.sdd/config.yml missing');
  assert(fs.existsSync(path.join(repo, 'AGENTS.md')), 'AGENTS.md missing');
  assert(
    fs.existsSync(path.join(repo, '.claude', 'commands', 'sdd', 'next.md')),
    'claude adapter missing'
  );

  const check = sdd(repo, ['check']);
  equal(check.status, 0, check.output);
  includes(check.output, 'check passed');
});

test('init is idempotent', () => {
  const again = sdd(repo, ['init']);
  equal(again.status, 0, again.output);
  includes(again.output, 'unchanged');
  equal(sdd(repo, ['check']).status, 0);
});

test('a locally edited kit file survives an upgrade and gets a .new sibling', () => {
  const file = path.join(repo, '.sdd', 'constitution.md');
  fs.appendFileSync(file, '\n## P11 - our own principle\n');
  const again = sdd(repo, ['init']);
  equal(again.status, 0, again.output);
  includes(fs.readFileSync(file, 'utf8'), 'P11 - our own principle');
  assert(fs.existsSync(`${file}.new`), 'expected constitution.md.new');
  includes(again.output, 'left alone');
});

test('init preserves text a project added to AGENTS.md outside our block', () => {
  const file = path.join(repo, 'AGENTS.md');
  fs.appendFileSync(file, '\n## Local conventions\nDo not touch this.\n');
  equal(sdd(repo, ['init']).status, 0);
  includes(fs.readFileSync(file, 'utf8'), 'Do not touch this.');
});

/* --------------------------------------------------------------- lifecycle */

process.stdout.write('\nlifecycle\n');

test('new scaffolds the artifacts the tier requires', () => {
  const created = sdd(repo, ['new', 'Driver scorecard']);
  equal(created.status, 0, created.output);
  const dir = path.join(repo, 'docs', 'specs', '001-driver-scorecard');
  for (const file of ['spec.md', 'design.md', 'tasks.md', 'evidence.md', 'runbook.md', 'gates.yml']) {
    assert(fs.existsSync(path.join(dir, file)), `${file} was not created`);
  }
  includes(fs.readFileSync(path.join(dir, 'spec.md'), 'utf8'), 'Driver scorecard');
});

test('tiny tier requires fewer artifacts than standard', () => {
  equal(sdd(repo, ['new', 'Rename a label', '--tier', 'tiny']).status, 0);
  const dir = path.join(repo, 'docs', 'specs', '002-rename-a-label');
  assert(fs.existsSync(path.join(dir, 'spec.md')), 'spec.md expected at tiny');
  assert(!fs.existsSync(path.join(dir, 'design.md')), 'design.md should not exist at tiny');
  assert(!fs.existsSync(path.join(dir, 'runbook.md')), 'runbook.md should not exist at tiny');
});

test('next reports the first stage and names the owning role', () => {
  const next = sdd(repo, ['next', '001']);
  equal(next.status, 0, next.output);
  includes(next.output, 'frame');
  includes(next.output, 'spec.product');
  includes(next.output, 'Product Manager');
});

test('gate records a sign-off with an identity and advances the ledger', () => {
  const result = sdd(repo, ['gate', 'spec.product', 'approve', '-m', 'reviewed', '--feature', '001']);
  equal(result.status, 0, result.output);
  const ledger = parseYaml(
    fs.readFileSync(path.join(repo, 'docs', 'specs', '001-driver-scorecard', 'gates.yml'), 'utf8')
  );
  equal(ledger.gates['spec.product'].status, 'approved');
  equal(ledger.gates['spec.product'].by, 'tester@example.com');
  includes(result.output, '1/');
});

test('next advances to the next blocking gate in the same stage', () => {
  includes(sdd(repo, ['next', '001']).output, 'spec.ux');
});

test('status lists every feature with its stage', () => {
  const status = sdd(repo, ['status']);
  equal(status.status, 0, status.output);
  includes(status.output, '001-driver-scorecard');
  includes(status.output, '002-rename-a-label');
});

test('a rejected gate keeps the stage open and shows the note', () => {
  equal(
    sdd(repo, ['gate', 'spec.ux', 'request-changes', '-m', 'no error states', '--feature', '001'])
      .status,
    0
  );
  const next = sdd(repo, ['next', '001']);
  includes(next.output, 'changes-requested');
  includes(next.output, 'no error states');
});

test('waiving without a reason is refused', () => {
  const result = sdd(repo, ['gate', 'spec.ux', 'waive', '--feature', '001']);
  equal(result.status, 1);
  includes(result.output, 'needs a reason');
});

test('gate rejects an id the flow does not declare', () => {
  const result = sdd(repo, ['gate', 'design.invented', 'approve', '-m', 'x', '--feature', '001']);
  equal(result.status, 1);
  includes(result.output, 'declares no gate');
});

/* ----------------------------------------------------------- check's teeth */

process.stdout.write('\ncheck\n');

test('a stage signed off with TODO(sdd) placeholders fails check', () => {
  equal(sdd(repo, ['gate', 'spec.ux', 'approve', '-m', 'ok', '--feature', '001']).status, 0);
  const result = sdd(repo, ['check', '001']);
  equal(result.status, 1, 'check should fail while placeholders remain');
  includes(result.output, 'TODO(sdd) placeholders remain');
});

test('filling the artifact clears the placeholder error', () => {
  const spec = path.join(repo, 'docs', 'specs', '001-driver-scorecard', 'spec.md');
  fs.writeFileSync(
    spec,
    '# Driver scorecard\n\nReal content, no markers.\n\n## Acceptance criteria\n\n| # | Criterion |\n| --- | --- |\n| AC1 | Loads in under 2s at p95 |\n',
    'utf8'
  );
  const result = sdd(repo, ['check', '001']);
  equal(result.status, 0, result.output);
});

test('an unknown gate status fails check', () => {
  const file = path.join(repo, 'docs', 'specs', '001-driver-scorecard', 'gates.yml');
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.replace('status: pending', 'status: probably-fine'), 'utf8');
  const result = sdd(repo, ['check', '001']);
  equal(result.status, 1);
  includes(result.output, 'unknown status');
  fs.writeFileSync(file, original, 'utf8');
});

test('a gate not declared by the flow fails check', () => {
  const file = path.join(repo, 'docs', 'specs', '001-driver-scorecard', 'gates.yml');
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, `${original}  totally.invented:\n    status: approved\n`, 'utf8');
  const result = sdd(repo, ['check', '001']);
  equal(result.status, 1);
  includes(result.output, 'not declared by flow');
  fs.writeFileSync(file, original, 'utf8');
});

test('a waiver without a reason fails check', () => {
  const file = path.join(repo, 'docs', 'specs', '001-driver-scorecard', 'gates.yml');
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.replace('status: pending', 'status: waived'), 'utf8');
  const result = sdd(repo, ['check', '001']);
  equal(result.status, 1);
  includes(result.output, 'waived without a reason');
  fs.writeFileSync(file, original, 'utf8');
});

/* ----------------------------------------------- extensibility, no code change */

process.stdout.write('\nextensibility\n');

test('a role dropped into .sdd/roles/ is discovered with no code change', () => {
  fs.writeFileSync(
    path.join(repo, '.sdd', 'roles', 'data-engineer.md'),
    [
      '---',
      'id: data-engineer',
      'name: Data Engineer',
      'owns: [design.md#data-pipeline]',
      'gates: [design.data-quality]',
      'reads: [spec.md, design.md]',
      'checklist: checklists/data-engineer.md',
      '---',
      '',
      '## Mission',
      'Own the pipeline feeding this feature.',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(repo, '.sdd', 'checklists', 'data-engineer.md'),
    '# Checklist - Data Engineer\n\n- [ ] Schema documented\n',
    'utf8'
  );

  const roles = sdd(repo, ['roles']);
  includes(roles.output, 'data-engineer');
  includes(roles.output, 'design.data-quality');
});

test('a new gate wired into a flow routes work to the new role', () => {
  const flow = path.join(repo, '.sdd', 'flows', 'feature.md');
  const text = fs
    .readFileSync(flow, 'utf8')
    .replace('      - design.observability', '      - design.observability\n      - design.data-quality')
    .replace('      - observability-engineer', '      - observability-engineer\n      - data-engineer');
  fs.writeFileSync(flow, text, 'utf8');

  equal(sdd(repo, ['check']).status, 1, 'existing ledgers should now be flagged as missing the gate');
  includes(sdd(repo, ['check']).output, 'design.data-quality');

  equal(sdd(repo, ['new', 'Telemetry ingest']).status, 0);
  for (const gate of ['spec.product', 'spec.ux']) {
    equal(sdd(repo, ['gate', gate, 'approve', '-m', 'ok', '--feature', '003']).status, 0);
  }
  const next = sdd(repo, ['next', '003']);
  includes(next.output, 'design.data-quality');
  includes(next.output, 'Data Engineer');
});

test('an override shadows a shipped role', () => {
  const dir = path.join(repo, '.sdd', 'overrides', 'roles');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'architect.md'),
    [
      '---',
      'id: architect',
      'name: Principal Architect',
      'owns: [design.md]',
      'gates: [design.architecture, spike.question, spike.finding]',
      'checklist: checklists/architect.md',
      '---',
      '',
      '## Mission',
      'Our own wording.',
      '',
    ].join('\n'),
    'utf8'
  );
  const roles = sdd(repo, ['roles']);
  includes(roles.output, 'Principal Architect');
  includes(roles.output, '[override]');
  equal(sdd(repo, ['roles', 'architect']).output.includes('Our own wording'), true);
});

test('a flow referencing a missing role fails check with the specific file', () => {
  const flow = path.join(repo, '.sdd', 'flows', 'spike.md');
  const original = fs.readFileSync(flow, 'utf8');
  fs.writeFileSync(flow, original.replace('roles: [architect, tech-lead]', 'roles: [ghost]'), 'utf8');
  const result = sdd(repo, ['check']);
  equal(result.status, 1);
  includes(result.output, 'spike.md');
  includes(result.output, 'ghost');
  fs.writeFileSync(flow, original, 'utf8');
});

/* -------------------------------------------------------------- doctor, sync */

process.stdout.write('\ndoctor and sync\n');

test('doctor reports the install without needing a valid feature set', () => {
  const result = sdd(repo, ['doctor']);
  equal(result.status, 0, result.output);
  includes(result.output, 'roles');
  includes(result.output, 'overrides');
});

test('doctor outside an installed repo exits 1 with guidance', () => {
  const empty = sandbox();
  const result = sdd(empty, ['doctor']);
  equal(result.status, 1);
  includes(result.output, 'init');
  fs.rmSync(empty, { recursive: true, force: true });
});

test('commands outside an installed repo explain themselves', () => {
  const empty = sandbox();
  const result = sdd(empty, ['next']);
  equal(result.status, 1);
  includes(result.output, 'fleet-sdd init');
  fs.rmSync(empty, { recursive: true, force: true });
});

test('parseTasks reads the template task table', () => {
  const table = parseTasks(
    ['# tasks', '', '| ID | Task | Role | Size | Status | Key |', '| --- | --- | --- | --- | --- | --- |', '| T1 | Do a thing | developer | M | todo | |', '| T2 | Do another | qa-engineer | S | todo | FIQ-9 |', '', 'trailing prose'].join('\n')
  );
  equal(table.rows.length, 2);
  equal(table.rows[0].task, 'Do a thing');
  equal(table.rows[1].key, 'FIQ-9');
});

test('sync is a dry run by default and never needs credentials', () => {
  const tasks = path.join(repo, 'docs', 'specs', '001-driver-scorecard', 'tasks.md');
  fs.writeFileSync(
    tasks,
    ['# tasks', '', '| ID | Task | Role | Size | Status | Key |', '| --- | --- | --- | --- | --- | --- |', '| T1 | Build the aggregation query | developer | M | todo | |', ''].join('\n'),
    'utf8'
  );
  const result = sdd(repo, ['sync', 'jira', '--feature', '001']);
  equal(result.status, 0, result.output);
  includes(result.output, 'Dry run');
  includes(result.output, 'Build the aggregation query');
  includes(fs.readFileSync(tasks, 'utf8'), '| T1 |');
});

test('sync refuses an unknown provider and says how to add one', () => {
  const result = sdd(repo, ['sync', 'trello', '--feature', '001']);
  equal(result.status, 1);
  includes(result.output, '.sdd/adapters/trello.mjs');
  includes(result.output, 'authoring-roles');
});

test('a repo-local adapter is picked up with no change to the package', () => {
  const dir = path.join(repo, '.sdd', 'adapters');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'zephyr.mjs'),
    [
      'export function syncTracker({ feature, apply, out }) {',
      '  out(`zephyr ran for ${feature.id}, apply=${apply}`);',
      '  return 0;',
      '}',
      '',
    ].join('\n'),
    'utf8'
  );

  const result = sdd(repo, ['sync', 'zephyr', '--feature', '001']);
  equal(result.status, 0, result.output);
  includes(result.output, 'using .sdd/adapters/zephyr.mjs');
  includes(result.output, 'zephyr ran for 001-driver-scorecard, apply=false');

  const listed = sdd(repo, ['sync', '--list']);
  includes(listed.output, 'zephyr');
  includes(listed.output, 'jira');
});

test('an adapter missing syncTracker is rejected, not silently ignored', () => {
  const file = path.join(repo, '.sdd', 'adapters', 'broken.mjs');
  fs.writeFileSync(file, 'export const nope = 1;\n', 'utf8');
  const result = sdd(repo, ['sync', 'broken', '--feature', '001']);
  equal(result.status, 1);
  includes(result.output, 'does not export syncTracker');
});

/* ------------------------------------------------------------ bundled specs */

process.stdout.write('\nbundled specs\n');

/**
 * The worked example and the framework's own spec must stay valid. They are the
 * documentation, so when a schema change breaks them the fix is the example --
 * never the validator.
 */
test('the bundled specs validate against a fresh install of the kit', () => {
  const clean = sandbox();
  const init = sdd(clean, ['init']);
  equal(init.status, 0, init.output);

  const sources = [
    path.join(ROOT, 'docs', 'specs', '000-fleet-sdd-framework'),
    path.join(ROOT, 'examples', 'specs', '001-driver-scorecard'),
  ];

  for (const source of sources) {
    assert(fs.existsSync(source), `${source} is missing`);
    const target = path.join(clean, 'docs', 'specs', path.basename(source));
    fs.mkdirSync(target, { recursive: true });
    for (const file of fs.readdirSync(source)) {
      fs.copyFileSync(path.join(source, file), path.join(target, file));
    }
  }

  const check = sdd(clean, ['check']);
  equal(check.status, 0, check.output);
  includes(check.output, '2 feature(s)');

  fs.rmSync(clean, { recursive: true, force: true });
});

test('the bundled specs contain no unresolved placeholders', () => {
  for (const dir of [
    path.join(ROOT, 'docs', 'specs', '000-fleet-sdd-framework'),
    path.join(ROOT, 'examples', 'specs', '001-driver-scorecard'),
  ]) {
    for (const file of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      // The framework's own spec discusses the marker by name; only flag it
      // where it appears as an actual unfilled placeholder at line start.
      const offenders = text
        .split(/\r?\n/)
        .filter((line) => /^\s*(?:[-*>|]\s*)?TODO\(sdd\)/.test(line));
      equal(offenders, [], `${path.basename(dir)}/${file} still has placeholders`);
    }
  }
});

test('every shipped role has a checklist that exists', () => {
  const rolesDir = path.join(ROOT, 'kit', '.sdd', 'roles');
  for (const file of fs.readdirSync(rolesDir)) {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(rolesDir, file), 'utf8'));
    equal(data.id, file.replace(/\.md$/, ''), `${file}: id must match the filename`);
    assert(data.checklist, `${file}: no checklist declared`);
    assert(
      fs.existsSync(path.join(ROOT, 'kit', '.sdd', data.checklist)),
      `${file}: checklist ${data.checklist} does not exist`
    );
  }
});

/* ---------------------------------------------------------------- diagrams */

process.stdout.write('\ndiagrams\n');

/**
 * The lifecycle diagram is generated from the flow definition, so a flow change
 * must not be able to leave a stale picture in the README.
 */
test('committed diagrams match what the generator produces', () => {
  const rendered = renderAll();
  const stale = [];

  for (const [name, contents] of Object.entries(rendered)) {
    const file = path.join(ROOT, 'docs', 'diagrams', name);
    if (!fs.existsSync(file)) {
      stale.push(`${name} (missing)`);
      continue;
    }
    if (fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== contents) stale.push(name);
  }

  equal(stale, [], 'run `npm run diagrams` and commit the result');
});

test('the generated lifecycle diagram reflects the real feature flow', () => {
  const svgText = renderAll()['lifecycle.svg'];
  const flow = parseFrontmatter(
    fs.readFileSync(path.join(ROOT, 'kit', '.sdd', 'flows', 'feature.md'), 'utf8')
  ).data;

  for (const stage of flow.stages) {
    includes(svgText, `>${stage.id}<`, `stage "${stage.id}" is missing from the diagram`);
    for (const gate of stage.gates) {
      includes(svgText, `>${gate}<`, `gate "${gate}" is missing from the diagram`);
    }
  }
});

test('every diagram referenced by the README exists on disk', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const referenced = [...readme.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
  assert(referenced.length > 0, 'README references no diagrams');
  for (const rel of referenced) {
    assert(fs.existsSync(path.join(ROOT, rel)), `README points at a missing file: ${rel}`);
  }
});

/* ----------------------------------------------------------------- intent */

test('the commissioning prompts are present and cross-linked', () => {
  for (const file of ['README.md', '00-original-brief.md', '01-modify-framework.md']) {
    const full = path.join(ROOT, 'docs', 'prompts', file);
    assert(fs.existsSync(full), `docs/prompts/${file} is missing`);
    assert(fs.readFileSync(full, 'utf8').trim().length > 500, `docs/prompts/${file} looks empty`);
  }

  // AGENTS.md is the entry point for anyone changing the framework, so the
  // brief has to be reachable from it or it will not be read.
  includes(
    fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8'),
    'docs/prompts/00-original-brief.md',
    'AGENTS.md must point at the original brief'
  );
});

test('every internal Markdown link in the repo resolves', () => {
  const broken = [];

  const walkDocs = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDocs(full);
      } else if (entry.name.endsWith('.md')) {
        const text = fs.readFileSync(full, 'utf8');
        for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
          const target = match[1].split('#')[0].trim();
          if (!target || /^[a-z]+:/i.test(target)) continue;
          if (!fs.existsSync(path.join(path.dirname(full), target))) {
            broken.push(`${path.relative(ROOT, full)} -> ${target}`);
          }
        }
      }
    }
  };

  walkDocs(ROOT);
  equal(broken, [], 'broken internal links');
});

test('the CLI declares no runtime dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  equal(Object.keys(pkg.dependencies || {}), [], 'dependencies must stay empty');
  equal(Object.keys(pkg.devDependencies || {}), [], 'devDependencies must stay empty');
});

/* -------------------------------------------------------------------- done */

fs.rmSync(repo, { recursive: true, force: true });

process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  process.stdout.write('\n');
  for (const failure of failures) {
    process.stdout.write(`--- ${failure.name}\n${failure.err.stack}\n\n`);
  }
  process.exitCode = 1;
}
