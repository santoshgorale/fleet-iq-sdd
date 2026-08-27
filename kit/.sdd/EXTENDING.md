# Extending Fleet SDD

Everything below is a Markdown or YAML file. There is no plugin API, no
registration step and no code to change. If you can write a file, you can extend
the framework.

The CLI only globs, validates and reports — the semantics live entirely in this
directory. That is deliberate: your team should be able to change how the
framework behaves without waiting for anyone.

---

## Add a role

Drop a file in `.sdd/roles/`. The filename is the id.

```markdown
---
id: data-engineer                       # must match the filename
name: Data Engineer
owns: [design.md#data-pipeline]         # sections this role writes
gates: [design.data-quality]            # gates this role may sign off
reads: [constitution.md, spec.md, design.md]
checklist: checklists/data-engineer.md  # optional, relative to .sdd/
handoff: architect                      # optional, who picks up next
---

## Mission
One paragraph: what this role is accountable for.

## Do this
1. Ordered, concrete steps against the artifacts named in `owns`.

## Definition of done
- [ ] …

## Never sign off on
- …
```

Then reference the gate from a flow stage, and it is live:

```bash
fleet-sdd roles          # your role appears
fleet-sdd check          # validates ownership and the checklist path
fleet-sdd next           # routes work to it
```

`check` will tell you if a gate has no owner, or an owner is missing from the
stage that uses it. A role that owns no gates is legal but gets a warning — no
gate means `next` can never route work to it.

## Add a gate

A gate exists when two things are true: a role lists it in `gates:`, and a flow
stage lists it in `gates:`. Nothing else is needed.

Name them `<stage>.<concern>` — `design.data-quality`, `operate.monitoring`. The
prefix is only a convention, but it makes `gates.yml` readable at a glance.

## Add a flow

Drop a file in `.sdd/flows/`, then `fleet-sdd new "…" --flow my-flow`.

```yaml
---
id: compliance-review
name: Compliance review
stages:
  - id: frame
    artifact: spec.md
    roles: [product-manager, security-engineer]
    gates: [spec.product, spec.regulatory]
---
```

Stage order is the order gates are evaluated. Each stage needs an id, an
artifact, at least one role and at least one gate.

## Add or change a checklist

`.sdd/checklists/<role>.md`, referenced from the role's front matter. Plain
Markdown checkboxes. These are what a reviewer actually works through, so keep
them short enough to be used — a forty-item checklist gets skimmed.

## Change a template

Edit `.sdd/templates/<artifact>.md`. Available placeholders: `{{FEATURE_ID}}`,
`{{TITLE}}`, `{{DATE}}`, `{{FLOW}}`, `{{TIER}}`, `{{OWNER}}`, `{{PLACEHOLDER}}`.

Keep `TODO(sdd)` markers on anything that must be filled in — a stage cannot be
signed off while its artifact still contains one. That is where the framework
gets its teeth.

If you edit `tasks.md`, keep the task table's column names; `fleet-sdd sync`
reads them.

## Add a team prompt or skill

Team-specific prompts live in `.sdd/prompts/` and are yours to organise. To make
one available as a Claude Code skill, add `.claude/skills/<name>/SKILL.md` in
your repo — Fleet SDD does not manage that directory beyond the commands it
installs, so nothing will overwrite it.

The useful pattern is a thin skill that reads `.sdd/`, rather than one that
restates it. Then improving the role file improves the skill for free, and the
two cannot drift apart.

## Change something the kit owns

Two options, and the difference matters at upgrade time.

**Edit in place.** `fleet-sdd init` notices your edit, leaves your file alone,
and writes the incoming version as `<file>.new` for you to merge. Nothing is
lost, but you get a merge to do on every upgrade.

**Override.** Copy the file to the same path under `.sdd/overrides/` and edit it
there. Overrides shadow the shipped file and are never touched by an upgrade.

```
.sdd/roles/architect.md              # shipped
.sdd/overrides/roles/architect.md    # yours -- wins, and survives upgrades
```

Prefer overrides for anything you intend to keep.

## Add a tracker or test-management adapter

`fleet-sdd sync` ships a Jira adapter. Add your own — Zephyr, Xray, Azure
DevOps, TestRail — as one file in this repo. Adapters resolve by name, yours
first:

```js
// .sdd/adapters/zephyr.mjs
export function syncTracker({ index, feature, provider, apply, out, colours }) {
  // Read <feature.dir>/tasks.md, parse the task table.
  // Dry run by default: only act when `apply` is true.
  // Credentials from process.env, never from this repo.
  // Write keys or results back into the artifacts.
  // Return a process exit code.
}
```

```bash
fleet-sdd sync --list       # shipped + local adapters
fleet-sdd sync zephyr       # dry run
fleet-sdd sync zephyr --apply
```

Dry-run-by-default is not optional: pushing to a tracker is an outward-facing
action. Neither is environment-only credentials.

Full contract, including what a test-management adapter should map, in the
framework's `docs/authoring-roles.md`.

## Remove something

Delete the file. If a flow still references a deleted role or gate, `check`
fails with the specific line — which is the intended way to find out.
