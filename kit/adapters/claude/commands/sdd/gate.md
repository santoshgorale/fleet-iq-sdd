---
description: Review a gate against its checklist, then record the verdict
argument-hint: "<gate-id> [approve|request-changes|review|waive|reset]"
allowed-tools: Bash(npx fleet-sdd:*), Bash(fleet-sdd:*), Read, Glob, Grep
---

# /sdd:gate

Arguments: `$ARGUMENTS`

## If a verdict was given

Run it, and report what opened up next:

```bash
npx fleet-sdd gate $ARGUMENTS
```

`waive` requires a reason: `-m "why this is acceptable"`. So does
`request-changes`, in practice — a rejection with no note wastes the next
person's afternoon.

## If only a gate id was given

Do the review first, then propose a verdict. Do not pick one for the user.

1. Find the owning role: `npx fleet-sdd next` names it, or search
   `.sdd/roles/` for the gate id in a `gates:` list.
2. Read `.sdd/checklists/<role>.md` and the artifact the gate covers.
3. Work the checklist item by item against what is actually written in the
   artifact. Not against what you remember, and not against what you would have
   written.
4. Report as a table: item, pass or fail, and the evidence — quote the line in
   the artifact that satisfies it. An item you cannot evidence is a fail.
5. Recommend a verdict with a one-line reason, and give the exact command.

Then stop. A gate is someone accepting accountability for a judgement; recording
it is theirs to do, not yours.

## Verdicts

| Verdict | Means |
| --- | --- |
| `approve` | Reviewed, accountable for it. |
| `request-changes` | Specific things must change. Always add a note. |
| `review` | Marks it in progress, so `status` shows work is happening. |
| `waive` | Deliberately skipped, with a recorded reason. Stays visible in the ledger. |
| `reset` | Back to pending. Use when an artifact changed after sign-off. |
