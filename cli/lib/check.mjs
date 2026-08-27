/**
 * Validation. `fleet-sdd check` is what gives the framework teeth: without it,
 * gates.yml is just a file people can lie in.
 *
 * Errors fail the command (exit 1). Warnings are printed and pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  listFeatures,
  requiredArtifactsFor,
  requiredGatesFor,
  flowGates,
} from './discover.mjs';
import { readGates, gateStatus, CLEARED, STATUSES } from './gates.mjs';

/** Marker left in templates. Signing off an artifact that still has one is a lie. */
export const PLACEHOLDER = 'TODO(sdd)';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class Findings {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }
  error(where, message) {
    this.errors.push({ where, message });
  }
  warn(where, message) {
    this.warnings.push({ where, message });
  }
  get ok() {
    return this.errors.length === 0;
  }
}

/** Validate the framework itself: config, roles, flows, checklists. */
export function checkFramework(index, findings = new Findings()) {
  const { root, config, roles, flows, gateOwners } = index;
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');

  if (roles.length === 0) findings.error('.sdd/roles/', 'no roles found');
  if (flows.length === 0) findings.error('.sdd/flows/', 'no flows found');

  if (!index.flowById.has(config.defaultFlow)) {
    findings.error(
      '.sdd/config.yml',
      `defaultFlow "${config.defaultFlow}" has no matching file in .sdd/flows/`
    );
  }
  if (!config.tiers?.[config.defaultTier]) {
    findings.error('.sdd/config.yml', `defaultTier "${config.defaultTier}" is not defined in tiers`);
  }

  for (const role of roles) {
    const where = rel(role.file);
    const expectedId = path.basename(role.file, '.md');
    if (role.id !== expectedId) {
      findings.error(where, `front matter id "${role.id}" does not match the filename "${expectedId}"`);
    }
    if (!role.name) findings.warn(where, 'no name in front matter; falling back to the id');
    if (role.gates.length === 0) {
      findings.warn(where, 'owns no gates, so `next` can never route work to it');
    }
    if (role.checklist) {
      const checklist = path.join(root, '.sdd', role.checklist);
      const override = path.join(root, '.sdd', 'overrides', role.checklist);
      if (!fs.existsSync(checklist) && !fs.existsSync(override)) {
        findings.error(where, `checklist "${role.checklist}" does not exist under .sdd/`);
      }
    }
    if (role.handoff && !index.roleById.has(role.handoff)) {
      findings.warn(where, `handoff "${role.handoff}" is not a known role`);
    }
  }

  for (const flow of flows) {
    const where = rel(flow.file);
    if (flow.stages.length === 0) {
      findings.error(where, 'declares no stages');
      continue;
    }

    const seenGates = new Set();
    for (const stage of flow.stages) {
      const at = `${where} (stage "${stage.id || '?'}")`;
      if (!stage.id) findings.error(at, 'stage has no id');
      if (!stage.artifact) findings.error(at, 'stage has no artifact');
      if (stage.roles.length === 0) findings.error(at, 'stage lists no roles');
      if (stage.gates.length === 0) findings.error(at, 'stage lists no gates');

      for (const roleId of stage.roles) {
        if (!index.roleById.has(roleId)) {
          findings.error(at, `role "${roleId}" has no file in .sdd/roles/`);
        }
      }

      for (const gate of stage.gates) {
        if (seenGates.has(gate)) findings.error(at, `gate "${gate}" is declared more than once`);
        seenGates.add(gate);

        const owners = gateOwners.get(gate) || [];
        if (owners.length === 0) {
          findings.error(at, `gate "${gate}" is not owned by any role -- nobody can sign it off`);
        } else if (!owners.some((o) => stage.roles.includes(o.id))) {
          findings.warn(
            at,
            `gate "${gate}" is owned by ${owners.map((o) => o.id).join(', ')}, ` +
              'none of which are listed in this stage'
          );
        }
      }
    }
  }

  for (const tierName of Object.keys(config.tiers || {})) {
    const tier = config.tiers[tierName];
    const required = tier?.requiredGates;
    if (required && required !== 'all' && Array.isArray(required)) {
      const known = new Set(flows.flatMap(flowGates));
      for (const gate of required) {
        if (!known.has(gate)) {
          findings.error('.sdd/config.yml', `tier "${tierName}" requires unknown gate "${gate}"`);
        }
      }
    }
  }

  return findings;
}

/** Validate one feature directory against its flow and tier. */
export function checkFeature(index, feature, findings = new Findings()) {
  const { config } = index;
  const where = `${config.specsDir}/${feature.id}`;

  let ledger;
  try {
    ledger = readGates(feature.dir);
  } catch (err) {
    findings.error(where, err.message);
    return findings;
  }

  if (ledger.feature && ledger.feature !== feature.id) {
    findings.warn(
      `${where}/gates.yml`,
      `feature id "${ledger.feature}" does not match the directory name "${feature.id}"`
    );
  }

  const flowId = ledger.flow || config.defaultFlow;
  const flow = index.flowById.get(flowId);
  if (!flow) {
    findings.error(`${where}/gates.yml`, `flow "${flowId}" has no file in .sdd/flows/`);
    return findings;
  }

  const tier = ledger.tier || config.defaultTier;
  if (!config.tiers?.[tier]) {
    findings.error(`${where}/gates.yml`, `tier "${tier}" is not defined in .sdd/config.yml`);
    return findings;
  }

  const required = requiredGatesFor(config, flow, tier);
  const requiredSet = new Set(required);
  const declared = new Set(flowGates(flow));

  for (const gate of required) {
    if (!(gate in (ledger.gates || {}))) {
      findings.error(`${where}/gates.yml`, `required gate "${gate}" is missing from the ledger`);
    }
  }

  for (const [gate, raw] of Object.entries(ledger.gates || {})) {
    const at = `${where}/gates.yml`;
    if (!declared.has(gate)) {
      findings.error(at, `gate "${gate}" is not declared by flow "${flowId}"`);
      continue;
    }

    const entry = typeof raw === 'string' ? { status: raw } : raw || {};
    const status = entry.status || 'pending';

    if (!STATUSES.includes(status)) {
      findings.error(at, `gate "${gate}" has unknown status "${status}" (expected one of ${STATUSES.join(', ')})`);
      continue;
    }
    if (status === 'waived' && !entry.reason) {
      findings.error(at, `gate "${gate}" is waived without a reason -- waivers must be justified`);
    }
    if ((status === 'approved' || status === 'changes-requested') && !entry.by) {
      findings.error(at, `gate "${gate}" is "${status}" with no "by" -- sign-offs need an owner`);
    }
    if (entry.at && !ISO_DATE.test(String(entry.at))) {
      findings.warn(at, `gate "${gate}" has date "${entry.at}"; expected YYYY-MM-DD`);
    }
    if (status === 'changes-requested' && !entry.note) {
      findings.warn(at, `gate "${gate}" requests changes without a note -- say what needs to change`);
    }
    if (!requiredSet.has(gate) && CLEARED.has(status)) {
      findings.warn(at, `gate "${gate}" is not required at tier "${tier}" but has been signed off`);
    }
  }

  // Required artifacts must exist and have content.
  const artifacts = requiredArtifactsFor(config, flow, tier);
  for (const artifact of artifacts) {
    const file = path.join(feature.dir, artifact);
    if (!fs.existsSync(file)) {
      findings.error(where, `required artifact "${artifact}" is missing at tier "${tier}"`);
      continue;
    }
    if (fs.readFileSync(file, 'utf8').trim().length === 0) {
      findings.error(where, `artifact "${artifact}" is empty`);
    }
  }

  // A stage cannot be signed off while its artifact still holds placeholders.
  for (const stage of flow.stages) {
    const stageGates = stage.gates.filter((g) => requiredSet.has(g));
    if (stageGates.length === 0) continue;
    if (!stageGates.every((g) => CLEARED.has(gateStatus(ledger, g)))) continue;

    const file = path.join(feature.dir, stage.artifact);
    if (!fs.existsSync(file)) {
      findings.error(
        where,
        `stage "${stage.id}" is fully signed off but its artifact "${stage.artifact}" does not exist`
      );
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(PLACEHOLDER)) {
      const lines = text
        .split(/\r?\n/)
        .map((line, i) => [i + 1, line])
        .filter(([, line]) => line.includes(PLACEHOLDER))
        .map(([n]) => n);
      findings.error(
        `${where}/${stage.artifact}`,
        `stage "${stage.id}" is signed off but ${PLACEHOLDER} placeholders remain ` +
          `(line${lines.length > 1 ? 's' : ''} ${lines.slice(0, 8).join(', ')})`
      );
    }
  }

  return findings;
}

/** Check the framework plus every feature (or just one). */
export function checkAll(index, featureHint = null) {
  const findings = new Findings();
  checkFramework(index, findings);

  const features = listFeatures(index.root, index.config).filter(
    (f) => !featureHint || f.id === featureHint
  );
  for (const feature of features) checkFeature(index, feature, findings);

  return { findings, featureCount: features.length };
}

export { Findings };
