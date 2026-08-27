---
description: Validate SDD artifacts and gates, then fix what is fixable
argument-hint: "[feature-id]"
allowed-tools: Bash(npx fleet-sdd:*), Bash(fleet-sdd:*), Read, Glob, Grep, Edit, Write
---

# /sdd:check

```bash
npx fleet-sdd check $ARGUMENTS
```

Exit code 1 means errors; warnings pass but are worth reading.

## What the errors mean

| Error | What actually happened |
| --- | --- |
| `required gate ... is missing from the ledger` | `gates.yml` was hand-edited, or the flow gained a gate after the feature was created. Add the gate as `pending`. |
| `gate ... is not declared by flow` | A gate id in `gates.yml` no longer exists in the flow. Remove it or fix the flow. |
| `gate ... is not owned by any role` | A flow references a gate no role lists in `gates:`. Nobody can sign it off. |
| `waived without a reason` | A waiver with no justification. Add one — that is the whole point of allowing waivers. |
| `TODO(sdd) placeholders remain` | A stage was signed off with an unfinished artifact. This is the framework's main line of defence; treat it as a real finding, not a formatting nit. |
| `checklist ... does not exist` | A role's front matter points at a missing file. |

## Fix what is genuinely fixable

Repair structural problems yourself — a missing gate entry, a stale gate id, a
checklist path typo.

**Do not** resolve a `TODO(sdd)` error by deleting the marker, and do not
invent content to fill it. That error means a human signed off on incomplete
work. The correct outcome is either real content or the gate being reset:

```bash
fleet-sdd gate <gate-id> reset
```

Say which of those you recommend, and why. Then report what you fixed, what
needs a human, and re-run `check` to show the result.
