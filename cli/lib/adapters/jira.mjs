/**
 * Optional tracker sync: tasks.md <-> Jira.
 *
 * Deliberate constraints:
 *   - Credentials come from the environment only, never from the repo.
 *   - Dry run is the default. Creating issues is outward-facing, so it needs
 *     an explicit `--apply`.
 *   - tasks.md stays the source of truth; we only write issue keys back into
 *     the Key column.
 *
 * The tracker contract is documented in docs/authoring-roles.md so a team can
 * drop in an Azure DevOps or GitHub adapter with the same shape.
 */

import fs from 'node:fs';
import path from 'node:path';
import { SddError } from '../discover.mjs';

/** Columns we expect in the tasks.md table, matched case-insensitively. */
const COLUMNS = { id: 'id', task: 'task', role: 'role', size: 'size', status: 'status', key: 'key' };

function splitRow(line) {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Parse the first Markdown table in tasks.md into rows.
 * Returns `{ header, rows, tableStart, tableEnd }` with line indices so we can
 * write keys back without reformatting the rest of the file.
 */
export function parseTasks(text) {
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue;

    const header = splitRow(lines[i]).map((h) => h.toLowerCase());
    const rows = [];
    let end = i + 2;
    while (end < lines.length && lines[end].trim().startsWith('|')) {
      const cells = splitRow(lines[end]);
      const row = { _line: end, _cells: cells };
      header.forEach((name, idx) => {
        row[name] = cells[idx] ?? '';
      });
      rows.push(row);
      end++;
    }

    return { header, rows, tableStart: i, tableEnd: end, lines };
  }

  return null;
}

function requireEnv() {
  if (typeof fetch !== 'function') {
    throw new SddError(
      `Pushing to Jira needs a built-in fetch, which arrived in Node 18. ` +
        `This is Node ${process.versions.node}.\n` +
        'Everything else in fleet-sdd works on Node 16 -- only `sync --apply` does not.'
    );
  }

  const missing = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new SddError(
      `Jira sync needs these environment variables: ${missing.join(', ')}.\n` +
        'Set them in your shell (never in the repo) and re-run with --apply.'
    );
  }
  return {
    baseUrl: process.env.JIRA_BASE_URL.replace(/\/+$/, ''),
    email: process.env.JIRA_EMAIL,
    token: process.env.JIRA_API_TOKEN,
  };
}

function buildPayload({ row, config, feature, ledger }) {
  const projectKey = config.tracker?.projectKey;
  if (!projectKey) {
    throw new SddError('Set tracker.projectKey in .sdd/config.yml before syncing to Jira.');
  }

  const labels = ['fleet-sdd', `feature-${feature.id}`.slice(0, 255)];
  if (row[COLUMNS.role]) labels.push(`role-${row[COLUMNS.role]}`.replace(/\s+/g, '-'));

  return {
    fields: {
      project: { key: projectKey },
      issuetype: { name: config.tracker?.issueType || 'Task' },
      summary: `[${feature.id}] ${row[COLUMNS.task] || row[COLUMNS.id]}`.slice(0, 250),
      description: [
        row[COLUMNS.task] || '',
        '',
        `Feature: ${feature.id}${ledger.title ? ` -- ${ledger.title}` : ''}`,
        `Task: ${row[COLUMNS.id] || '(unnumbered)'}`,
        `Role: ${row[COLUMNS.role] || '(unassigned)'}`,
        `Spec: ${config.specsDir}/${feature.id}/spec.md`,
        `Design: ${config.specsDir}/${feature.id}/design.md`,
      ].join('\n'),
      labels,
    },
  };
}

async function createIssue({ baseUrl, email, token }, payload) {
  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new SddError(`Jira responded ${response.status}: ${body.slice(0, 500)}`);
  }
  return JSON.parse(body).key;
}

/**
 * Sync one feature's tasks.md to the tracker.
 * Returns a process exit code.
 */
export function syncTracker({ index, feature, provider, apply, out, colours }) {
  const { bold, dim, cyan, green, yellow } = colours;
  const tasksFile = path.join(feature.dir, 'tasks.md');
  if (!fs.existsSync(tasksFile)) {
    throw new SddError(`${feature.id} has no tasks.md -- run the slice stage first.`);
  }

  const text = fs.readFileSync(tasksFile, 'utf8');
  const table = parseTasks(text);
  if (!table) {
    throw new SddError(
      `No Markdown task table found in ${feature.id}/tasks.md.\n` +
        'Keep the "| ID | Task | Role | Size | Status | Key |" table from the template.'
    );
  }

  for (const column of ['id', 'task']) {
    if (!table.header.includes(column)) {
      throw new SddError(`tasks.md table is missing a "${column}" column.`);
    }
  }
  const hasKeyColumn = table.header.includes(COLUMNS.key);

  const ledger = { title: '' };
  try {
    const gates = fs.readFileSync(path.join(feature.dir, 'gates.yml'), 'utf8');
    const match = /^title:\s*(.+)$/m.exec(gates);
    if (match) ledger.title = match[1].replace(/^["']|["']$/g, '').trim();
  } catch {
    /* title is cosmetic */
  }

  const linked = table.rows.filter((row) => hasKeyColumn && row[COLUMNS.key]);
  // Template rows left blank, and rows still holding a TODO(sdd) marker, are
  // not real tasks -- pushing them to a tracker just makes noise someone has
  // to clean up.
  const incomplete = table.rows.filter(
    (row) =>
      !(hasKeyColumn && row[COLUMNS.key]) &&
      (!row[COLUMNS.id] || !row[COLUMNS.task] || row[COLUMNS.task].includes('TODO(sdd)'))
  );
  const pending = table.rows.filter(
    (row) => !linked.includes(row) && !incomplete.includes(row)
  );

  out();
  out(bold(`${provider} sync -- ${feature.id}`));
  out(
    `${dim('rows')} ${table.rows.length}   ${dim('already linked')} ${linked.length}   ` +
      `${dim('not ready')} ${incomplete.length}   ${dim('to create')} ${pending.length}`
  );
  if (incomplete.length) {
    out(
      dim(
        `  ${incomplete.length} row(s) skipped: blank, or still holding a TODO(sdd) marker.`
      )
    );
  }
  if (!hasKeyColumn) {
    out(yellow('  tasks.md has no "Key" column, so issue keys cannot be written back.'));
  }

  if (pending.length === 0) {
    out();
    out(green('Nothing to do.'));
    out();
    return 0;
  }

  const payloads = pending.map((row) => ({
    row,
    payload: buildPayload({ row, config: index.config, feature, ledger }),
  }));

  if (!apply) {
    out();
    out(yellow('Dry run. Nothing was sent. Re-run with --apply to create these issues.'));
    out();
    for (const { row, payload } of payloads) {
      out(`  ${bold(row[COLUMNS.id])} ${payload.fields.summary}`);
      out(`      ${dim(`${payload.fields.issuetype.name} in ${payload.fields.project.key}`)}`);
      out(`      ${dim(`labels: ${payload.fields.labels.join(', ')}`)}`);
    }
    out();
    out(dim(`  needs JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in the environment`));
    out();
    return 0;
  }

  const credentials = requireEnv();

  return (async () => {
    const lines = [...table.lines];
    const keyIndex = table.header.indexOf(COLUMNS.key);
    let created = 0;

    for (const { row, payload } of payloads) {
      const key = await createIssue(credentials, payload);
      created++;
      out(`  ${green('created')} ${key.padEnd(12)} ${payload.fields.summary}`);

      if (hasKeyColumn) {
        const cells = [...row._cells];
        cells[keyIndex] = key;
        lines[row._line] = `| ${cells.join(' | ')} |`;
      }
    }

    if (hasKeyColumn && created > 0) {
      fs.writeFileSync(tasksFile, lines.join('\n'), 'utf8');
      out();
      out(`Wrote ${created} issue key(s) back into ${cyan(`${feature.id}/tasks.md`)}.`);
    }

    out();
    return 0;
  })();
}
