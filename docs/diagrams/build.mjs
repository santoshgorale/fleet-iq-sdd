#!/usr/bin/env node
/**
 * Diagram generator: `npm run diagrams`.
 *
 * Writes plain SVG into this folder. SVG rather than Mermaid because Mermaid
 * only renders on GitHub -- not in VS Code without an extension, not in most
 * Markdown previews, and not in a PDF export. An `<img>` tag pointing at an SVG
 * renders everywhere.
 *
 * The lifecycle diagram is generated FROM `kit/.sdd/flows/feature.md` and the
 * role files, so it cannot drift from the framework it documents. `npm test`
 * regenerates and compares, and fails if the committed files are stale.
 *
 * Zero dependencies, like everything else here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, asList } from '../../cli/lib/yaml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const KIT = path.join(ROOT, 'kit', '.sdd');

/* ------------------------------------------------------------------ palette */

// An explicit light ground is painted on every diagram, so these read the same
// against a dark README as a light one.
const C = {
  bg: '#ffffff',
  ink: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  card: '#f8fafc',
  cardEdge: '#cbd5e1',
  band: '#f1f5f9',
  chip: '#e2e8f0',
  gate: '#1d4ed8',
  gateSoft: '#eef2ff',
  accent: '#b45309',
  accentFill: '#fffbeb',
  accentEdge: '#f59e0b',
  ok: '#15803d',
  okFill: '#f0fdf4',
};

const FONT = 'system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/* ------------------------------------------------------------------ helpers */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function text(x, y, content, o = {}) {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${o.mono ? MONO : FONT}"`,
    `font-size="${o.size ?? 11}"`,
    `fill="${o.fill ?? C.ink}"`,
  ];
  if (o.weight) attrs.push(`font-weight="${o.weight}"`);
  if (o.anchor) attrs.push(`text-anchor="${o.anchor}"`);
  if (o.spacing) attrs.push(`letter-spacing="${o.spacing}"`);
  if (o.opacity) attrs.push(`opacity="${o.opacity}"`);
  return `<text ${attrs.join(' ')}>${esc(content)}</text>`;
}

function rect(x, y, w, h, o = {}) {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `width="${w}"`,
    `height="${h}"`,
    `rx="${o.rx ?? 8}"`,
    `fill="${o.fill ?? C.card}"`,
  ];
  if (o.stroke) attrs.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw ?? 1}"`);
  if (o.dash) attrs.push(`stroke-dasharray="${o.dash}"`);
  return `<rect ${attrs.join(' ')} />`;
}

function line(x1, y1, x2, y2, o = {}) {
  const attrs = [
    `x1="${x1}"`,
    `y1="${y1}"`,
    `x2="${x2}"`,
    `y2="${y2}"`,
    `stroke="${o.stroke ?? C.cardEdge}"`,
    `stroke-width="${o.sw ?? 1}"`,
  ];
  if (o.dash) attrs.push(`stroke-dasharray="${o.dash}"`);
  if (o.marker) attrs.push(`marker-end="url(#${o.marker})"`);
  return `<line ${attrs.join(' ')} />`;
}

/** Wrap a label to a pixel width, approximating character advance. */
function wrap(content, maxWidth, size) {
  const perChar = size * 0.53;
  const limit = Math.max(6, Math.floor(maxWidth / perChar));
  const words = String(content).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function svg(width, height, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="${C.faint}" />
  </marker>
  <marker id="arrowInk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="${C.ink}" />
  </marker>
</defs>
<rect x="0" y="0" width="${width}" height="${height}" fill="${C.bg}" />
${body}
</svg>
`;
}

function heading(x, y, title, subtitle) {
  return [
    text(x, y, title, { size: 17, weight: 700 }),
    subtitle ? text(x, y + 21, subtitle, { size: 11.5, fill: C.muted }) : '',
  ].join('\n');
}

function label(x, y, content) {
  return text(x, y, content.toUpperCase(), {
    size: 8.5,
    weight: 700,
    fill: C.faint,
    spacing: 0.8,
  });
}

/* ------------------------------------------------------- framework metadata */

/** Roles whose disciplines classically arrive too late to change anything. */
const EARLY = new Set([
  'security-engineer',
  'performance-engineer',
  'observability-engineer',
  'support-lead',
]);

const SHORT = {
  'product-manager': 'Product',
  'ux-designer': 'UX',
  'product-owner': 'Product Owner',
  architect: 'Architect',
  'tech-lead': 'Tech Lead',
  developer: 'Developer',
  'test-lead': 'Test Lead',
  'qa-engineer': 'QA',
  'devops-engineer': 'DevOps',
  'security-engineer': 'Security',
  'performance-engineer': 'Performance',
  'observability-engineer': 'Observability',
  'support-lead': 'Support',
};

function readFlow(id) {
  const { data } = parseFrontmatter(fs.readFileSync(path.join(KIT, 'flows', `${id}.md`), 'utf8'));
  return (data.stages || []).map((s) => ({
    id: s.id,
    name: s.name || s.id,
    artifact: s.artifact,
    roles: asList(s.roles),
    gates: asList(s.gates),
  }));
}

function readRoleNames() {
  const dir = path.join(KIT, 'roles');
  const names = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    const id = data.id || file.replace(/\.md$/, '');
    names[id] = SHORT[id] || data.name || id;
  }
  return names;
}

/* ------------------------------------------------- 1. lifecycle (generated) */

function lifecycleDiagram() {
  const stages = readFlow('feature');
  const roleNames = readRoleNames();

  const W = 1240;
  const M = 24;
  const GAP = 26;
  const CW = Math.round((W - M * 2 - GAP * (stages.length - 1)) / stages.length);
  const PITCH = CW + GAP;
  const TOP = 96;

  // Tallest card decides the band height, so a longer flow still fits.
  const maxRoles = Math.max(...stages.map((s) => s.roles.length));
  const maxGates = Math.max(...stages.map((s) => s.gates.length));
  const CH = 88 + maxRoles * 16 + 22 + maxGates * 15 + 14;
  const H = TOP + CH + 96;

  const parts = [
    heading(
      M,
      36,
      'Fleet SDD — the feature flow',
      'Six stages. Each produces one artifact and is opened by gates, not by a date.'
    ),
  ];

  stages.forEach((stage, i) => {
    const x = M + i * PITCH;
    const accent = stage.roles.some((r) => EARLY.has(r));

    parts.push(
      rect(x, TOP, CW, CH, {
        fill: accent ? C.accentFill : C.card,
        stroke: accent ? C.accentEdge : C.cardEdge,
      })
    );

    // Header
    parts.push(
      `<circle cx="${x + 20}" cy="${TOP + 20}" r="10.5" fill="${accent ? C.accentEdge : C.ink}" />`,
      text(x + 20, TOP + 24, String(i + 1), {
        size: 11,
        weight: 700,
        fill: '#ffffff',
        anchor: 'middle',
      }),
      text(x + 38, TOP + 24, stage.id, { size: 13, weight: 700 }),
      text(x + 12, TOP + 44, stage.name, { size: 9.5, fill: C.muted })
    );

    // Artifact chip
    parts.push(
      rect(x + 10, TOP + 54, CW - 20, 22, { rx: 5, fill: C.chip }),
      text(x + CW / 2, TOP + 69, stage.artifact, {
        size: 10.5,
        mono: true,
        anchor: 'middle',
        weight: 600,
      })
    );

    // Roles
    let y = TOP + 100;
    parts.push(label(x + 12, y - 6, 'roles'));
    for (const roleId of stage.roles) {
      const early = EARLY.has(roleId);
      parts.push(
        text(x + 12, y + 10, `${early ? '◆' : '○'}  ${roleNames[roleId] || roleId}`, {
          size: 10.5,
          fill: early ? C.accent : C.ink,
          weight: early ? 600 : 400,
        })
      );
      y += 16;
    }

    // Gates
    y += 12;
    parts.push(label(x + 12, y, 'gates'));
    y += 15;
    for (const gate of stage.gates) {
      parts.push(text(x + 12, y, gate, { size: 9.5, mono: true, fill: C.gate }));
      y += 15;
    }

    // Chain arrow
    if (i < stages.length - 1) {
      parts.push(
        line(x + CW + 5, TOP + CH / 2, x + CW + GAP - 5, TOP + CH / 2, {
          stroke: C.faint,
          sw: 1.5,
          marker: 'arrow',
        })
      );
    }
  });

  // Footer: shipped pill and legend
  const fy = TOP + CH + 34;
  parts.push(
    rect(M, fy, 150, 30, { rx: 15, fill: C.okFill, stroke: C.ok }),
    text(M + 75, fy + 19, 'gates clear → shipped', {
      size: 10,
      weight: 600,
      fill: C.ok,
      anchor: 'middle',
    }),
    text(M + 172, fy + 13, '◆', { size: 10, fill: C.accent }),
    text(M + 186, fy + 13, 'Security, Performance, Observability and Support hold gates here —', {
      size: 10.5,
      fill: C.ink,
    }),
    text(M + 186, fy + 27, 'at design time, not as a review of finished work. That placement is the point.', {
      size: 10.5,
      fill: C.muted,
    }),
    text(W - M, fy + 20, 'generated from kit/.sdd/flows/feature.md', {
      size: 9.5,
      fill: C.faint,
      anchor: 'end',
      mono: true,
    })
  );

  return svg(W, H, 'Fleet SDD feature flow: six stages, their artifacts, roles and gates', parts.join('\n'));
}

/* ------------------------------------------------------- 2. SDLC / STLC map */

function lifecycleMappingDiagram() {
  const W = 1240;
  const M = 24;
  const GAP = 26;
  const COLS = 6;
  const CW = Math.round((W - M * 2 - GAP * (COLS - 1)) / COLS);
  const PITCH = CW + GAP;

  const columns = [
    { stage: 'frame', sdlc: ['Requirements'], stlc: ['Requirement analysis'] },
    { stage: 'shape', sdlc: ['Design & architecture'], stlc: ['Test strategy input'] },
    { stage: 'slice', sdlc: ['Planning'], stlc: ['Test planning', 'Test case design', 'Environment setup'] },
    { stage: 'build', sdlc: ['Development'], stlc: ['Unit & integration'] },
    { stage: 'prove', sdlc: ['Verification'], stlc: ['Test execution'] },
    { stage: 'operate', sdlc: ['Deployment', 'Operations'], stlc: ['Closure & regression'] },
  ];

  const SDLC_Y = 104;
  const CHIP_H = 30;
  const SDD_Y = 208;
  const SDD_H = 74;
  const STLC_Y = 330;
  const H = 570;

  const parts = [
    heading(
      M,
      36,
      'How it maps onto SDLC and STLC',
      'Fleet SDD does not replace your lifecycle. It gives each phase an artifact, an owner and a gate.'
    ),
    label(M, SDLC_Y - 12, 'SDLC · delivery lifecycle'),
    label(M, SDD_Y - 12, 'Fleet SDD · artifact + owner + gate'),
    label(M, STLC_Y - 12, 'STLC · testing lifecycle'),
  ];

  columns.forEach((col, i) => {
    const x = M + i * PITCH;
    const cx = x + CW / 2;

    // SDLC chips
    col.sdlc.forEach((name, k) => {
      const y = SDLC_Y + k * (CHIP_H + 6);
      parts.push(
        rect(x, y, CW, CHIP_H, { rx: 6, fill: C.band, stroke: C.cardEdge }),
        text(cx, y + 19, name, { size: 10.5, anchor: 'middle' })
      );
    });

    // Fleet SDD band
    const accent = col.stage === 'shape' || col.stage === 'operate';
    parts.push(
      rect(x, SDD_Y, CW, SDD_H, {
        fill: accent ? C.accentFill : C.card,
        stroke: accent ? C.accentEdge : C.cardEdge,
        sw: 1.5,
      }),
      text(cx, SDD_Y + 27, col.stage, { size: 13, weight: 700, anchor: 'middle' }),
      text(cx, SDD_Y + 48, `${i + 1} of 6`, { size: 9, fill: C.muted, anchor: 'middle' }),
      text(cx, SDD_Y + 65, ['spec.md', 'design.md', 'tasks.md', 'evidence.md', 'evidence.md', 'runbook.md'][i], {
        size: 9.5,
        mono: true,
        fill: C.muted,
        anchor: 'middle',
      })
    );

    // STLC chips
    col.stlc.forEach((name, k) => {
      const y = STLC_Y + k * (CHIP_H + 6);
      parts.push(
        rect(x, y, CW, CHIP_H, { rx: 6, fill: C.band, stroke: C.cardEdge }),
        text(cx, y + 19, name, { size: 10.5, anchor: 'middle' })
      );
    });

    // Dotted connectors
    const sdlcBottom = SDLC_Y + col.sdlc.length * (CHIP_H + 6) - 6;
    parts.push(
      line(cx, sdlcBottom + 4, cx, SDD_Y - 4, { stroke: C.faint, dash: '3 4', marker: 'arrow' }),
      line(cx, SDD_Y + SDD_H + 4, cx, STLC_Y - 4, { stroke: C.faint, dash: '3 4', marker: 'arrow' })
    );
  });

  // Callouts
  const ny = 440;
  const noteW = (W - M * 2 - 24) / 2;
  const notes = [
    [
      'Testing starts at requirements, not at build',
      'tasks.testability is a gate in slice, held by the Test Lead, whose first question is "could I write a failing test for this today?" An untestable acceptance criterion is cheapest to fix while it is still a sentence.',
    ],
    [
      'Operations is inside the lifecycle, not after it',
      'operate is stage six, not a hand-off. operate.monitoring requires that every alert has been deliberately fired and observed to route — an alert nobody has seen fire is a belief, not a control.',
    ],
  ];

  notes.forEach(([title, body], i) => {
    const x = M + i * (noteW + 24);
    parts.push(
      rect(x, ny, noteW, 96, { fill: C.accentFill, stroke: C.accentEdge }),
      text(x + 14, ny + 24, title, { size: 11.5, weight: 700, fill: C.accent })
    );
    wrap(body, noteW - 28, 10.5).forEach((ln, k) => {
      parts.push(text(x + 14, ny + 44 + k * 14, ln, { size: 10.5, fill: C.ink }));
    });
  });

  return svg(W, H, 'Fleet SDD stages mapped against SDLC and STLC phases', parts.join('\n'));
}

/* ------------------------------------------------------- 3. tool integration */

function integrationDiagram() {
  const W = 1200;
  const H = 620;
  const M = 24;

  const parts = [
    heading(
      M,
      36,
      'How it fits your tooling',
      'Fleet SDD owns Markdown in git. Everything else connects through a thin adapter, and the artifacts stay the source of truth.'
    ),
  ];

  // Centre: the repo
  const cx = 430;
  const cw = 340;
  const cy = 110;
  const ch = 300;
  parts.push(
    rect(cx, cy, cw, ch, { fill: C.card, stroke: C.ink, sw: 1.5 }),
    text(cx + cw / 2, cy + 28, 'Your repo', { size: 14, weight: 700, anchor: 'middle' }),
    text(cx + cw / 2, cy + 46, 'the source of truth', { size: 10, fill: C.muted, anchor: 'middle' }),
    rect(cx + 20, cy + 62, cw - 40, 86, { rx: 6, fill: '#ffffff', stroke: C.cardEdge }),
    text(cx + 34, cy + 84, '.sdd/', { size: 12, weight: 700, mono: true }),
    text(cx + 34, cy + 102, 'roles · flows · checklists', { size: 10, fill: C.muted }),
    text(cx + 34, cy + 118, 'templates · constitution', { size: 10, fill: C.muted }),
    text(cx + 34, cy + 137, 'adapters/  ← yours drop in here', { size: 9.5, mono: true, fill: C.accent }),
    rect(cx + 20, cy + 160, cw - 40, 118, { rx: 6, fill: '#ffffff', stroke: C.cardEdge }),
    text(cx + 34, cy + 182, 'docs/specs/<feature>/', { size: 12, weight: 700, mono: true }),
    ...['spec.md', 'design.md', 'tasks.md', 'evidence.md', 'runbook.md', 'gates.yml'].map((f, i) =>
      text(cx + 34 + (i % 2) * 140, cy + 202 + Math.floor(i / 2) * 17, f, {
        size: 10,
        mono: true,
        fill: i === 5 ? C.gate : C.ink,
      })
    )
  );

  // Left: AI tooling
  const lw = 330;
  const lx = M + 22;
  parts.push(label(lx, 96, 'AI tooling · reads .sdd/, restates nothing'));
  const agents = [
    ['Claude Code', '/sdd:next · /sdd:role · sdd-review skill'],
    ['Cursor', '.cursor/rules/sdd.mdc'],
    ['GitHub Copilot', '.github/copilot-instructions.md'],
    ['Any other agent', 'AGENTS.md at the repo root'],
  ];
  agents.forEach(([name, sub], i) => {
    const y = 112 + i * 62;
    parts.push(
      rect(lx, y, lw - 60, 50, { fill: C.band, stroke: C.cardEdge }),
      text(lx + 14, y + 21, name, { size: 11.5, weight: 600 }),
      text(lx + 14, y + 37, sub, { size: 9.5, fill: C.muted, mono: true }),
      line(lx + lw - 56, y + 25, cx - 6, y + 25, { stroke: C.faint, marker: 'arrow' })
    );
  });

  // Right: third-party tools
  const rx = cx + cw + 86;
  const rw = W - rx - M;
  parts.push(label(rx, 96, 'Third-party tools · via adapters'));
  const tools = [
    ['Jira', 'tasks.md rows → issues, keys written back', 'shipped', C.ok],
    ['Zephyr · Xray · TestRail', 'test approach → cycles, results → evidence.md', '.sdd/adapters/', C.accent],
    ['Azure DevOps · GitHub Issues', 'same contract, one file', '.sdd/adapters/', C.accent],
    ['CI', 'fleet-sdd check — exit 1 blocks the merge', 'no adapter', C.muted],
    ['Grafana · Datadog · PagerDuty', 'designed in design.md, linked from runbook.md', 'no adapter', C.muted],
  ];
  tools.forEach(([name, sub, badge, badgeColour], i) => {
    const y = 112 + i * 62;
    parts.push(
      rect(rx, y, rw, 50, { fill: C.band, stroke: C.cardEdge }),
      text(rx + 14, y + 20, name, { size: 11.5, weight: 600 }),
      text(rx + 14, y + 36, sub, { size: 9.5, fill: C.muted }),
      text(rx + rw - 12, y + 20, badge, { size: 9, mono: true, fill: badgeColour, anchor: 'end' }),
      line(cx + cw + 6, y + 25, rx - 6, y + 25, { stroke: C.faint, marker: 'arrow' })
    );
  });

  // Footer
  const fy = 470;
  parts.push(
    rect(M, fy, W - M * 2, 118, { fill: C.accentFill, stroke: C.accentEdge }),
    text(M + 18, fy + 26, 'Adding a tool takes one file — no fork, no pull request against the framework', {
      size: 12,
      weight: 700,
      fill: C.accent,
    }),
    text(M + 18, fy + 50, '// .sdd/adapters/zephyr.mjs', { size: 10.5, mono: true, fill: C.muted }),
    text(M + 18, fy + 68, 'export function syncTracker({ index, feature, apply, out, colours }) {', {
      size: 10.5,
      mono: true,
    }),
    text(M + 18, fy + 84, '  // Read tasks.md. Dry run unless `apply`. Credentials from process.env.', {
      size: 10.5,
      mono: true,
      fill: C.muted,
    }),
    text(M + 18, fy + 100, '}', { size: 10.5, mono: true }),
    text(W - M - 18, fy + 100, 'fleet-sdd sync zephyr --apply', {
      size: 10.5,
      mono: true,
      fill: C.gate,
      anchor: 'end',
    })
  );

  return svg(W, H, 'Fleet SDD integration with AI tooling and third-party trackers', parts.join('\n'));
}

/* ---------------------------------------------------------------- 4. skills */

function skillsDiagram() {
  const W = 1060;
  const H = 500;
  const M = 24;

  const parts = [
    heading(
      M,
      36,
      'Skills compose with the framework',
      'Fleet SDD defines the process. Skills are how a particular job gets done well. Neither has to know the other exists.'
    ),
  ];

  const cardW = (W - M * 2 - 24 * 2) / 3;
  const skills = [
    ['sdd-review', 'Ships with the kit. Reviews an artifact against the checklists of every role that owns part of it. Contains no role knowledge of its own.', C.ok, C.okFill],
    ['Your own', 'Craft a role file should not carry: house-style PRDs, your threat-model method, a SQL migration review. Write it thin — have it read .sdd/.', C.accent, C.accentFill],
    ['From elsewhere', 'A marketplace or another team. Drops into .claude/skills/ and works. Name it in a role’s "Do this" steps to wire it into the flow.', C.gate, C.gateSoft],
  ];

  skills.forEach(([title, body, edge, fill], i) => {
    const x = M + i * (cardW + 24);
    parts.push(
      rect(x, 90, cardW, 118, { fill, stroke: edge }),
      text(x + 14, 114, title, { size: 12.5, weight: 700, fill: edge })
    );
    wrap(body, cardW - 28, 10.5).forEach((ln, k) => {
      parts.push(text(x + 14, 134 + k * 14, ln, { size: 10.5, fill: C.ink }));
    });
    parts.push(line(x + cardW / 2, 212, x + cardW / 2, 250, { stroke: C.faint, marker: 'arrow' }));
  });

  // The framework
  parts.push(
    rect(M, 254, W - M * 2, 74, { fill: C.card, stroke: C.ink, sw: 1.5 }),
    text(M + 18, 280, '.sdd/', { size: 13, weight: 700, mono: true }),
    text(M + 18, 300, 'roles · checklists · flows · constitution', { size: 10.5, fill: C.muted }),
    text(W / 2 + 60, 282, 'skills read this; it never reads them', {
      size: 10.5,
      fill: C.accent,
      anchor: 'middle',
    }),
    text(W / 2 + 60, 300, 'so editing a checklist improves every skill, and neither can drift', {
      size: 10,
      fill: C.muted,
      anchor: 'middle',
    }),
    line(W / 2, 332, W / 2, 366, { stroke: C.faint, marker: 'arrow' }),
    rect(M, 370, W - M * 2, 58, { fill: C.band, stroke: C.cardEdge }),
    text(W / 2, 396, 'docs/specs/<feature>/  —  work from every source lands in the same artifacts', {
      size: 11.5,
      weight: 600,
      anchor: 'middle',
    }),
    text(W / 2, 414, 'reviewed in one diff, gated by one ledger', {
      size: 10,
      fill: C.muted,
      anchor: 'middle',
    }),
    text(M, 460, 'Or skip skills entirely — six slash commands cover the lifecycle, and every artifact is readable by a person with no AI tooling at all.', {
      size: 10.5,
      fill: C.muted,
    })
  );

  return svg(W, H, 'How skills compose with the Fleet SDD framework', parts.join('\n'));
}

/* ------------------------------------------------------------------- output */

export const DIAGRAMS = {
  'lifecycle.svg': lifecycleDiagram,
  'sdlc-stlc-mapping.svg': lifecycleMappingDiagram,
  'integrations.svg': integrationDiagram,
  'skills.svg': skillsDiagram,
};

/** Render every diagram to a { filename: contents } map. */
export function renderAll() {
  const out = {};
  for (const [name, fn] of Object.entries(DIAGRAMS)) out[name] = fn();
  return out;
}

function main() {
  const rendered = renderAll();
  for (const [name, contents] of Object.entries(rendered)) {
    fs.writeFileSync(path.join(HERE, name), contents, 'utf8');
    const kb = (Buffer.byteLength(contents) / 1024).toFixed(1);
    process.stdout.write(`  wrote docs/diagrams/${name}  (${kb} kB)\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
