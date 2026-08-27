/**
 * Installing and upgrading the kit inside a product repo.
 *
 * The hard requirement is that `init` is idempotent and never destroys work.
 * That is achieved with two mechanisms:
 *
 *   - A manifest (`.sdd/.manifest.json`) recording the hash of every file as it
 *     was installed. On re-init, a file whose hash still matches is upgraded
 *     silently; a locally modified file is left alone and the new version is
 *     written alongside as `<name>.new`.
 *   - Marked blocks for files the repo also owns (AGENTS.md, CLAUDE.md,
 *     .gitignore). We only ever replace the text between our own markers.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KIT_DIR = path.resolve(HERE, '..', '..', 'kit');
export const MANIFEST_REL = path.join('.sdd', '.manifest.json');

const BLOCK_BEGIN = '<!-- fleet-sdd:begin -->';
const BLOCK_END = '<!-- fleet-sdd:end -->';

export const ADAPTERS = {
  claude: { from: path.join('adapters', 'claude'), to: '.claude' },
  cursor: { from: path.join('adapters', 'cursor'), to: '.cursor' },
  copilot: { from: path.join('adapters', 'github'), to: '.github' },
};

function sha256(text) {
  return crypto.createHash('sha256').update(normalise(text)).digest('hex');
}

/** Hash on normalised content so Windows CRLF checkouts don't read as edits. */
function normalise(text) {
  return text.replace(/\r\n/g, '\n');
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

function render(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

function readManifest(target) {
  const file = path.join(target, MANIFEST_REL);
  if (!fs.existsSync(file)) return { version: null, files: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { version: parsed.version ?? null, files: parsed.files || {} };
  } catch {
    return { version: null, files: {} };
  }
}

function writeManifest(target, manifest) {
  const file = path.join(target, MANIFEST_REL);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${JSON.stringify({ ...manifest, installedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, normalise(content), 'utf8');
}

/**
 * Insert or replace our marked block in a file the repo also owns.
 * Never touches anything outside the markers.
 */
function upsertBlock(file, body, { begin = BLOCK_BEGIN, end = BLOCK_END } = {}) {
  const block = `${begin}\n${body.trim()}\n${end}`;

  if (!fs.existsSync(file)) {
    writeFile(file, `${block}\n`);
    return 'created';
  }

  const existing = normalise(fs.readFileSync(file, 'utf8'));
  const startAt = existing.indexOf(begin);
  const endAt = existing.indexOf(end);

  if (startAt !== -1 && endAt > startAt) {
    const next = existing.slice(0, startAt) + block + existing.slice(endAt + end.length);
    if (next === existing) return 'unchanged';
    writeFile(file, next);
    return 'updated';
  }

  writeFile(file, `${existing.replace(/\s*$/, '')}\n\n${block}\n`);
  return 'appended';
}

const GITIGNORE_BEGIN = '# >>> fleet-sdd >>>';
const GITIGNORE_END = '# <<< fleet-sdd <<<';
const GITIGNORE_BODY = [
  '# Per-developer SDD state -- which feature you are currently working on.',
  '.sdd/.current',
  '',
  '# Written by `fleet-sdd init` when a kit file you edited has a newer version.',
  '*.new',
].join('\n');

/**
 * Build the list of (source, destination, mode) triples for an install.
 * `mode` is 'file' for manifest-tracked copies and 'block' for marked blocks.
 */
export function planInstall(target, { adapters }) {
  const jobs = [];

  for (const rel of walk(path.join(KIT_DIR, '.sdd'))) {
    jobs.push({
      source: path.join(KIT_DIR, '.sdd', rel),
      dest: path.join(target, '.sdd', rel),
      rel: path.join('.sdd', rel),
      mode: 'file',
    });
  }

  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const source = path.join(KIT_DIR, `${name}.tmpl`);
    if (fs.existsSync(source)) {
      jobs.push({ source, dest: path.join(target, name), rel: name, mode: 'block' });
    }
  }

  for (const adapter of adapters) {
    const spec = ADAPTERS[adapter];
    if (!spec) continue;
    const from = path.join(KIT_DIR, spec.from);
    for (const rel of walk(from)) {
      const isBlock = rel === 'copilot-instructions.md';
      jobs.push({
        source: path.join(from, rel),
        dest: path.join(target, spec.to, rel),
        rel: path.join(spec.to, rel),
        mode: isBlock ? 'block' : 'file',
        adapter,
      });
    }
  }

  return jobs;
}

/**
 * Copy the kit into `target`.
 * Returns a report the caller prints; nothing here writes to stdout.
 */
export function install(target, { adapters = ['claude'], project, dryRun = false } = {}) {
  const manifest = readManifest(target);
  const nextFiles = { ...manifest.files };
  const report = { created: [], updated: [], unchanged: [], conflicts: [], blocks: [] };

  const vars = {
    PROJECT: project || path.basename(path.resolve(target)),
    DATE: new Date().toISOString().slice(0, 10),
    SPECS_DIR: 'docs/specs',
    VERSION: '1.0.0',
  };

  for (const job of planInstall(target, { adapters })) {
    const content = render(fs.readFileSync(job.source, 'utf8'), vars);

    if (job.mode === 'block') {
      if (!dryRun) {
        const outcome = upsertBlock(job.dest, content);
        report.blocks.push({ rel: job.rel, outcome });
      } else {
        report.blocks.push({ rel: job.rel, outcome: 'dry-run' });
      }
      continue;
    }

    const incomingHash = sha256(content);

    if (!fs.existsSync(job.dest)) {
      if (!dryRun) writeFile(job.dest, content);
      nextFiles[job.rel] = incomingHash;
      report.created.push(job.rel);
      continue;
    }

    const currentHash = sha256(fs.readFileSync(job.dest, 'utf8'));

    if (currentHash === incomingHash) {
      nextFiles[job.rel] = incomingHash;
      report.unchanged.push(job.rel);
      continue;
    }

    const recorded = manifest.files[job.rel];
    if (recorded && recorded === currentHash) {
      // We installed this file and nobody has touched it -- safe to upgrade.
      if (!dryRun) writeFile(job.dest, content);
      nextFiles[job.rel] = incomingHash;
      report.updated.push(job.rel);
      continue;
    }

    // Locally modified (or pre-existing). Leave it; offer the new version.
    if (!dryRun) writeFile(`${job.dest}.new`, content);
    report.conflicts.push(job.rel);
  }

  if (!dryRun) {
    upsertBlock(path.join(target, '.gitignore'), GITIGNORE_BODY, {
      begin: GITIGNORE_BEGIN,
      end: GITIGNORE_END,
    });
    writeManifest(target, { version: vars.VERSION, files: nextFiles });
  }

  return report;
}

export { sha256, readManifest, upsertBlock, walk, render };
