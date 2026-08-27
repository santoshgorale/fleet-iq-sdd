# Authoring

How to make the framework yours. Everything here is a Markdown or YAML file —
there is no plugin API and no code to change, because the CLI only globs,
validates and reports.

`.sdd/EXTENDING.md` ships inside every install as the short version. This is the
long one.

---

## Add a role

Two files and one flow edit — about five minutes.

**1. The role.** `.sdd/roles/data-engineer.md`. Filename must match `id`.

```markdown
---
id: data-engineer
name: Data Engineer
owns: [design.md#data-pipeline]
gates: [design.data-quality]
reads: [constitution.md, spec.md, design.md]
checklist: checklists/data-engineer.md
handoff: architect
---

## Mission
One paragraph. What is this role accountable for that no other role is?

## Do this
1. Ordered, concrete steps against the artifacts in `owns`.

## Definition of done
- [ ] …

## Never sign off on
- …
```

**2. The checklist.** `.sdd/checklists/data-engineer.md`. Plain checkboxes.
Keep it short enough to be used — a forty-item checklist gets skimmed, and a
skimmed checklist is worse than a short one because it feels thorough.

**3. Wire the gate into a flow.** A gate exists only when a role claims it *and*
a stage lists it:

```yaml
  - id: shape
    artifact: design.md
    roles: [architect, tech-lead, security-engineer, data-engineer]
    gates: [design.architecture, design.security, design.data-quality]
```

**4. Verify.**

```bash
fleet-sdd roles          # appears
fleet-sdd check          # ownership and checklist path validated
fleet-sdd next           # routes work to it
```

`check` will tell you if the gate has no owner, or the owner is missing from the
stage that uses it. Existing features will be flagged as missing the new gate —
add it to their `gates.yml` as `pending`, or leave them on the old gate set.

### Writing a role that earns its place

The four sections do different jobs, and the last two are where the value is.

**Mission** must say what this role is accountable for *that no other role is*.
If you cannot, the role is probably a section in an existing one.

**Do this** should be ordered and specific enough that someone new to the role
could follow it. "Review the design" is not a step. "Walk spoofing, tampering,
repudiation, information disclosure, denial of service and elevation of privilege
against each trust boundary" is.

**Definition of done** is what the role checks before signing.

**Never sign off on** is the most useful section in the file. It is where the
experience lives — the specific mistakes this role has learned to catch. Look at
`.sdd/roles/observability-engineer.md` for the shape: *"an alert nobody has seen
fire is a belief, not a control."* Write yours from real incidents.

## Add a gate

Name them `<stage>.<concern>`: `design.data-quality`, `operate.monitoring`. The
prefix is convention only, but it keeps `gates.yml` readable at a glance.

Before adding one, ask what a *rejection* would look like. A gate nobody would
ever reject is a checkbox, and checkboxes make the ledger noisier without making
anything safer.

## Add a flow

`.sdd/flows/<id>.md`, then `fleet-sdd new "…" --flow <id>`.

```yaml
---
id: compliance-review
name: Compliance review
description: >-
  For changes touching regulated data.
stages:
  - id: frame
    name: State the obligation
    artifact: spec.md
    roles: [product-manager, security-engineer]
    gates: [spec.product, spec.regulatory]
---
```

Every stage needs an `id`, an `artifact`, at least one role and at least one
gate. Stage order is the order gates are evaluated.

You can reuse gate ids across flows — `spec.product` appears in all three
shipped flows. Within a single flow, each gate id must appear once.

## Add a tier

Tiers say which **gates** are required; artifacts are derived from that. An
artifact is required when the stage producing it has at least one required gate.

```yaml
tiers:
  hotfix:
    description: Production is down. Minimum viable rigour.
    requiredGates: [spec.product, build.code-review, operate.release]
```

This is why tiers are flow-agnostic — `hotfix` will behave sensibly on a flow
written after it. Use `extraArtifacts` for files no stage produces:

```yaml
  complex:
    requiredGates: all
    extraArtifacts: [decisions.md]
```

## Change a template

`.sdd/templates/<artifact>.md`. Placeholders: `{{FEATURE_ID}}`, `{{TITLE}}`,
`{{DATE}}`, `{{FLOW}}`, `{{TIER}}`, `{{OWNER}}`, `{{PLACEHOLDER}}`.

Keep `TODO(sdd)` markers on anything that must be filled in — that is where the
framework gets its teeth. A stage cannot be signed off while its artifact still
holds one.

If you edit `tasks.md`, keep the task table's column names (`ID`, `Task`, `Role`,
`Size`, `Status`, `Key`); `fleet-sdd sync` reads them.

## Add a team prompt or skill

Team-specific prompts live in `.sdd/prompts/`, organised however you like.

For a Claude Code skill, add `.claude/skills/<name>/SKILL.md` in your repo.
Fleet SDD does not manage that directory beyond the commands it installs, so
nothing will overwrite it.

**Write the skill thin.** Have it *read* `.sdd/` rather than restate it — then
improving a role file improves the skill for free, and the two cannot drift
apart. `.claude/skills/sdd-review/SKILL.md` is the model: it contains no role
knowledge at all, only instructions for finding and applying whatever the repo
currently defines.

## Add a tracker adapter

One file in **your own repo** — no fork, no pull request against this package.
Adapters resolve by name, repo-local first:

```
.sdd/adapters/<provider>.mjs     # yours -- wins
cli/lib/adapters/<provider>.mjs  # shipped (jira)
```

```js
// .sdd/adapters/zephyr.mjs
export function syncTracker({ index, feature, provider, apply, out, colours }) {
  // 1. Read <feature.dir>/tasks.md and parse the task table.
  // 2. Build a payload per row that has no key yet.
  // 3. If !apply, print the payloads and return 0. This is the default.
  // 4. Credentials from process.env only -- never from the repo.
  // 5. On success, write keys back into the table's Key column.
  // 6. Return a process exit code (or a Promise of one).
}
```

```bash
npx fleet-sdd sync --list          # shipped + local adapters
npx fleet-sdd sync zephyr          # dry run
npx fleet-sdd sync zephyr --apply
```

| Field | Is |
| --- | --- |
| `index` | The loaded `.sdd/` index — `config`, `roles`, `flows`, `gateOwners` |
| `feature` | `{ id, dir }` for the resolved feature |
| `provider` | The name you were invoked as |
| `apply` | `false` unless the user passed `--apply`. Respect it. |
| `out` | `(line) => void`. Write through this, not `console.log`. |
| `colours` | `{ bold, dim, cyan, green, yellow, red }` — already NO_COLOR-aware |

`cli/lib/adapters/jira.mjs` is the reference — about 200 lines, most of it the
Markdown table round-trip. `parseTasks` is exported from it for reuse:

```js
import { parseTasks } from 'fleet-sdd/cli/lib/adapters/jira.mjs';
```

Two constraints are not negotiable. **Dry run by default** — pushing to a tracker
is outward-facing and awkward to undo. **Credentials from the environment only**
— a config file in git is how tokens leak.

A repo-local adapter is executed, so it is code your repo owns: the same trust
model as a build script or a git hook. Review it like one.

### What a test-management adapter maps

For Zephyr, Xray or TestRail the useful direction is usually both ways:

| Fleet SDD | Tracker |
| --- | --- |
| `tasks.md#test-approach` levels and regression scope | A test cycle or plan |
| Acceptance criteria in `spec.md` | Test cases, linked to the criterion id |
| `tasks.md#traceability` | The coverage report you already have to produce |
| Execution results | `evidence.md#functional-verification` rows |

Writing results *back* into `evidence.md` is the higher-value half — it is what
keeps `prove.functional` resting on evidence rather than on someone's memory of a
green dashboard.

## Wire `check` into CI

Nothing is wired by default, deliberately: turning a new process into a merge
blocker on day one is how frameworks get resented. When the team is ready:

```yaml
- run: npx fleet-sdd check
```

Exit 1 on error. Start it as a non-blocking job, let people see what it catches,
and make it required once the gate set has settled from real use.

## Remove something

Delete the file. If a flow still references a deleted role or gate, `check` fails
with the specific file and line — which is the intended way to find out.

Deleting a gate that features already reference will flag those ledgers. Remove
the entries, or leave them: `check` reports an undeclared gate as an error, so
you will not forget.

## The one rule

**Semantics live in `.sdd/`; the CLI stays dumb.** If you find yourself wanting
to add logic to `cli/` to express something about your process, that is a signal
the process belongs in a role, flow or checklist instead. Keeping the CLI free of
opinions is what lets thirteen roles — and the next thirteen — evolve without a
release.
