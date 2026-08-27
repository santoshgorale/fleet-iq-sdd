---
description: Scaffold a new SDD feature and start framing it
argument-hint: "<title> [--flow feature|bugfix|spike] [--tier tiny|standard|complex]"
allowed-tools: Bash(npx fleet-sdd:*), Bash(fleet-sdd:*), Read, Edit, Write
---

# /sdd:new

Create a feature's artifacts and make a real start on `spec.md`.

## Step 1 — pick the flow and tier deliberately

Before running anything, decide:

| Flow | Use when |
| --- | --- |
| `feature` | New capability. Six stages, full gate set. |
| `bugfix` | A defect with a reproduction. Skips solution shaping. |
| `spike` | A time-boxed question. Output is a decision, not a feature. |

| Tier | Use when |
| --- | --- |
| `tiny` | Copy change, config, small fix. Trims the gate set. |
| `standard` | The default. |
| `complex` | Cross-team or high-risk. Adds a decision record. |

If the user's request does not make the choice obvious, ask. Guessing `standard`
on a one-line copy change buries the team in ceremony; guessing `tiny` on a
payments change is worse.

## Step 2 — scaffold

```bash
npx fleet-sdd new $ARGUMENTS
```

## Step 3 — frame the problem

Read `.sdd/constitution.md` and `.sdd/roles/product-manager.md`, then fill
`spec.md` as the Product Manager: problem with evidence, users and jobs, scope
and out-of-scope, acceptance criteria, success measures.

Use what the user told you. Where you do not know, leave the `TODO(sdd)` marker
and list it as an open question — inventing a plausible-sounding problem
statement is worse than an honest gap, because it reads as settled.

## Step 4 — report

Show the user:

- the feature directory and the files created
- what you filled in
- the open questions blocking `spec.product`
- `fleet-sdd next` as the way to continue

Do not approve gates.
