---
name: sdd-review
description: >-
  Review a Fleet SDD artifact (spec.md, design.md, tasks.md, evidence.md,
  runbook.md) against the checklists of the roles that own it, before a human
  signs the gate. Use when asked to review a spec or design, check whether a
  feature is ready for a gate, find what a spec or design is missing, or audit a
  feature directory under docs/specs/. Also use when asked whether something is
  ready to ship, or what would block sign-off.
---

# SDD artifact review

Review one artifact the way the roles that own it would, and report findings a
human can act on. This skill reads the repo's own `.sdd/` definitions rather
than carrying its own opinions — so when the team edits a role or checklist, the
review changes with it.

## 1. Establish the frame

```bash
npx fleet-sdd next        # active stage, blocking gates, owning roles
npx fleet-sdd check       # structural problems first
```

Fix nothing yet. Structural errors from `check` change what a review even means
— if a stage was signed off with placeholders still in the artifact, that is the
headline finding, not a footnote.

## 2. Find every role that owns part of the artifact

Read each file in `.sdd/roles/` and collect those whose `owns:` list mentions
the artifact. A single file usually has several owners: `design.md` is written by
the Architect but its Security, Performance and Observability sections belong to
three other roles, each with its own gate.

Check `.sdd/overrides/roles/` first — an override shadows the shipped file.

## 3. Review section by section, owner by owner

For each owning role, load `.sdd/checklists/<role>.md` and work it against what
the artifact actually says.

Two rules keep this honest:

**Evidence or it is a fail.** For every satisfied item, quote the line that
satisfies it. If you cannot point at the text, the item is not met — however
confident the document sounds. Vague prose passing a specific check is the
failure mode this whole framework exists to prevent.

**Judge what is written, not what is meant.** You may be able to infer the
intent behind a thin section. The next person cannot. Report the gap.

Also apply the role's **Never sign off on** list. Those lines are the sharpest
part of a role definition and catch things checklists miss.

## 4. Report

Per role, a table:

| Checklist item | Verdict | Evidence or gap |
| --- | --- | --- |

Then, once:

- **Blocking findings** — what must change before the gate can be signed, most
  serious first.
- **Worth fixing** — real but not blocking.
- **Cross-cutting gaps** — the ones no single checklist catches: a success
  measure in `spec.md` with no SLI in `design.md`, a performance budget nobody
  is monitoring, an alert with no runbook entry, a criterion with no task. These
  are usually the most valuable findings, because each one falls between two
  roles and so belongs to neither.
- **Recommended verdict per gate**, with the command to record it.

## 5. Stop there

Do not run `fleet-sdd gate`. Signing a gate means accepting accountability for a
judgement, and that belongs to a person. Your job is to make their five minutes
of review land on the right five things.
