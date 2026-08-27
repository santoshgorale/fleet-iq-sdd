/**
 * A deliberately small YAML subset: block maps, block sequences, flow
 * collections, scalars, comments and multi-line flow collections.
 *
 * This exists so the CLI has ZERO runtime dependencies (see docs/DESIGN.md,
 * "Zero runtime dependencies"). It is not a general YAML implementation --
 * it covers exactly what `.sdd/` files and front matter use. Anchors,
 * block scalars (`|`, `>`), multi-document streams and complex keys are not
 * supported; `parseYaml` throws a readable error rather than guessing.
 */

/** Strip an unquoted `#` comment from a single line. */
function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

/** Net bracket depth of a line, ignoring bracket characters inside quotes. */
function bracketDelta(line) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (const c of line) {
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
    }
  }
  return depth;
}

const BLOCK_SCALAR = /^(.*?):[ \t]*([|>])([+-]?)[ \t]*$/;

/**
 * Collect the body of a block scalar (`key: |` or `key: >-`).
 * Comments are NOT stripped inside one -- a `#` there is content.
 * Chomping is always clipped: trailing blank lines are dropped, which is what
 * every value in `.sdd/` wants.
 */
function readBlockScalar(rawLines, start, baseIndent, style) {
  const body = [];
  let bodyIndent = null;
  let i = start;

  while (i < rawLines.length) {
    const line = rawLines[i];
    if (!line.trim()) {
      body.push('');
      i++;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent <= baseIndent) break;
    if (bodyIndent === null) bodyIndent = indent;
    body.push(line.slice(Math.min(bodyIndent, indent)).replace(/\s+$/, ''));
    i++;
  }

  while (body.length && body[body.length - 1] === '') body.pop();

  const value =
    style === '|'
      ? body.join('\n')
      : body.reduce((acc, line, index) => {
          if (index === 0) return line;
          if (line === '') return `${acc}\n`;
          if (acc.endsWith('\n')) return acc + line;
          return `${acc} ${line}`;
        }, '');

  return { value, next: i };
}

/**
 * Turn text into a flat token list of `{ indent, seq, text }`.
 *
 * Sequence items are normalised: `- id: frame` becomes a bare marker token at
 * the dash's column followed by a content token two columns deeper. That makes
 * `- key: value` and a nested block map identical to the parser, so the rest of
 * the code has only one shape to handle.
 */
function tokenize(text) {
  const rawLines = text.split(/\r?\n/);
  const tokens = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = stripComment(rawLines[i]);
    if (!line.trim()) continue;

    // Join continuation lines while a flow collection is still open, so a
    // multi-line `[a, b,\n c]` or `{ ... }` reads as one logical line.
    let depth = bracketDelta(line);
    while (depth > 0 && i + 1 < rawLines.length) {
      i++;
      line += ' ' + stripComment(rawLines[i]).trim();
      depth += bracketDelta(stripComment(rawLines[i]));
    }

    let indent = line.length - line.trimStart().length;
    let content = line.trim();

    while (content === '-' || content.startsWith('- ')) {
      tokens.push({ indent, seq: true, text: '' });
      if (content === '-') {
        content = '';
        break;
      }
      content = content.slice(2).trim();
      indent += 2;
    }

    if (!content) continue;

    const block = BLOCK_SCALAR.exec(content);
    if (block && block[1].trim() && !block[1].includes(':')) {
      const { value, next } = readBlockScalar(rawLines, i + 1, indent, block[2]);
      tokens.push({ indent, seq: false, text: `${block[1].trim()}: ${JSON.stringify(value)}` });
      i = next - 1;
      continue;
    }

    tokens.push({ indent, seq: false, text: content });
  }

  return tokens;
}

/** Split `key: rest` at the first top-level, unquoted `key:` boundary. */
function splitKey(text) {
  let inSingle = false;
  let inDouble = false;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
      else if (c === ':' && depth === 0 && (i + 1 === text.length || /\s/.test(text[i + 1]))) {
        return { key: unquote(text.slice(0, i).trim()), rest: text.slice(i + 1).trim() };
      }
    }
  }
  return null;
}

function unquote(s) {
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    return s
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

/** Split the inside of a flow collection on top-level commas. */
function splitFlow(body) {
  const parts = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let current = '';

  for (const c of body) {
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;

    if (!inSingle && !inDouble) {
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += c;
  }

  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseScalar(text) {
  const t = text.trim();

  if (t.startsWith('[') && t.endsWith(']')) {
    return splitFlow(t.slice(1, -1)).map(parseScalar);
  }

  if (t.startsWith('{') && t.endsWith('}')) {
    const obj = {};
    for (const part of splitFlow(t.slice(1, -1))) {
      const kv = splitKey(part);
      if (kv) obj[kv.key] = kv.rest === '' ? null : parseScalar(kv.rest);
      else obj[unquote(part)] = null;
    }
    return obj;
  }

  if (t === '' || t === '~' || t === 'null') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;

  const quoted = t[0] === '"' || t[0] === "'";
  if (!quoted && /^-?\d+$/.test(t)) return Number.parseInt(t, 10);
  if (!quoted && /^-?\d*\.\d+$/.test(t)) return Number.parseFloat(t);

  return unquote(t);
}

function parseBlock(tokens, index, indent) {
  if (tokens[index].seq) return parseSequence(tokens, index, indent);
  // A line with no top-level `key:` is a plain scalar -- e.g. a sequence item
  // like `- architect`, or a flow collection like `[a, b]`.
  if (!splitKey(tokens[index].text)) return [parseScalar(tokens[index].text), index + 1];
  return parseMapping(tokens, index, indent);
}

function parseSequence(tokens, index, indent) {
  const items = [];
  let i = index;

  while (i < tokens.length && tokens[i].indent === indent && tokens[i].seq) {
    i++; // consume the marker
    if (i < tokens.length && tokens[i].indent > indent) {
      const [value, next] = parseBlock(tokens, i, tokens[i].indent);
      items.push(value);
      i = next;
    } else {
      items.push(null);
    }
  }

  return [items, i];
}

function parseMapping(tokens, index, indent) {
  const obj = {};
  let i = index;

  while (i < tokens.length && tokens[i].indent === indent && !tokens[i].seq) {
    const kv = splitKey(tokens[i].text);
    if (!kv) {
      throw new Error(`cannot parse line as a mapping entry: ${JSON.stringify(tokens[i].text)}`);
    }

    if (kv.rest !== '') {
      obj[kv.key] = parseScalar(kv.rest);
      i++;
      continue;
    }

    i++;
    // A nested block is either indented further, or is a sequence at the same
    // column as its key -- both are valid YAML.
    const nested =
      i < tokens.length &&
      (tokens[i].indent > indent || (tokens[i].indent === indent && tokens[i].seq));

    if (nested) {
      const [value, next] = parseBlock(tokens, i, tokens[i].indent);
      obj[kv.key] = value;
      i = next;
    } else {
      obj[kv.key] = null;
    }
  }

  return [obj, i];
}

/** Parse a YAML subset document. Returns `{}` for empty input. */
export function parseYaml(text) {
  const tokens = tokenize(text || '');
  if (tokens.length === 0) return {};
  const [value] = parseBlock(tokens, 0, tokens[0].indent);
  return value;
}

const NEEDS_QUOTES =
  /^$|^[\s]|[\s]$|^[-?:,[\]{}#&*!|>'"%@`]|:\s|\s#|^(true|false|null|~|yes|no|on|off)$|^-?\d/i;

function scalarToYaml(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const s = String(value);
  return NEEDS_QUOTES.test(s) ? JSON.stringify(s) : s;
}

/** Emit block-style YAML. Readable and, more importantly, diff-friendly. */
export function stringifyYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]\n`;
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          const nested = stringifyYaml(item, indent + 2);
          return `${pad}-${nested.slice(indent + 1)}`;
        }
        return `${pad}- ${scalarToYaml(item)}\n`;
      })
      .join('');
  }

  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return `${pad}{}\n`;
    return keys
      .map((key) => {
        const v = value[key];
        const k = scalarToYaml(key);
        if (v !== null && typeof v === 'object') {
          const isEmpty = Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0;
          if (isEmpty) return `${pad}${k}: ${Array.isArray(v) ? '[]' : '{}'}\n`;
          return `${pad}${k}:\n${stringifyYaml(v, indent + 2)}`;
        }
        return `${pad}${k}: ${scalarToYaml(v)}\n`;
      })
      .join('');
  }

  return `${pad}${scalarToYaml(value)}\n`;
}

/**
 * Split a Markdown file into `{ data, body }` where `data` is the parsed
 * `---` front matter. Files without front matter yield `data: {}`.
 */
export function parseFrontmatter(text) {
  const normalised = (text || '').replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(normalised);
  if (!match) return { data: {}, body: normalised };
  return { data: parseYaml(match[1]), body: normalised.slice(match[0].length) };
}

/** Coerce a front-matter value that should be a list into one. */
export function asList(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.filter((v) => v !== null && v !== '');
  return [value];
}
