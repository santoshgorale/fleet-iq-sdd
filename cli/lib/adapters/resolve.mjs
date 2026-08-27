/**
 * Adapter resolution.
 *
 * `fleet-sdd sync <provider>` loads `<provider>.mjs`, preferring a repo-local
 * adapter over a shipped one. That is what makes "add your own tracker" a real
 * claim rather than an aspiration: drop `.sdd/adapters/zephyr.mjs` in and
 * `sync zephyr` works, with no change to this package.
 *
 * Repo-local adapters are executed, so they are code the repo owns — the same
 * trust model as a build script or a git hook.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { SddError } from '../discover.mjs';

const SHIPPED_DIR = path.dirname(fileURLToPath(import.meta.url));

function localDir(root) {
  return path.join(root, '.sdd', 'adapters');
}

/** Where we would look for `provider`, highest precedence first. */
export function adapterCandidates(root, provider) {
  return [path.join(localDir(root), `${provider}.mjs`), path.join(SHIPPED_DIR, `${provider}.mjs`)];
}

function listIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.mjs') && name !== 'resolve.mjs')
    .map((name) => name.replace(/\.mjs$/, ''));
}

/** Every adapter available here: shipped plus repo-local. */
export function listAdapters(root) {
  const shipped = listIn(SHIPPED_DIR);
  const local = listIn(localDir(root));
  return {
    shipped,
    local,
    all: [...new Set([...local, ...shipped])].sort(),
  };
}

/** Load an adapter module, or explain what is available instead. */
export async function loadAdapter(root, provider) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(provider)) {
    throw new SddError(
      `"${provider}" is not a valid adapter name (letters, digits and hyphens only).`
    );
  }

  for (const file of adapterCandidates(root, provider)) {
    if (!fs.existsSync(file)) continue;
    const module = await import(pathToFileURL(file).href);
    if (typeof module.syncTracker !== 'function') {
      throw new SddError(
        `${path.relative(root, file)} does not export syncTracker().\n` +
          'See docs/authoring-roles.md ("Add a tracker adapter") for the contract.'
      );
    }
    return { syncTracker: module.syncTracker, file, local: file.startsWith(localDir(root)) };
  }

  const { all } = listAdapters(root);
  throw new SddError(
    `No adapter for "${provider}".\n` +
      `Available: ${all.join(', ') || '(none)'}\n\n` +
      'To add one, create .sdd/adapters/' +
      `${provider}.mjs exporting syncTracker({ index, feature, provider, apply, out, colours }).\n` +
      'The contract is in docs/authoring-roles.md ("Add a tracker adapter").'
  );
}
