---
description: What is next on the current feature, and do that work
argument-hint: "[feature-id]"
allowed-tools: Bash(npx fleet-sdd:*), Bash(fleet-sdd:*), Read, Glob, Grep, Edit, Write
---

# /sdd:next

The one command anyone has to remember. Find out where the feature stands, then
do the work the framework is asking for.

## Step 1 — ask the ledger

```bash
npx fleet-sdd next $ARGUMENTS
```

This prints the active stage, the artifact it produces, every blocking gate, the
role that owns each one, and its checklist path. Do not guess any of this from
the repo — the ledger is the authority.

## Step 2 — load the lens

For the first blocking gate, read in this order:

1. `.sdd/constitution.md` — the non-negotiables. A principle here outranks
   anything convenient.
2. `.sdd/roles/<owning-role>.md` — the role's mission, steps, definition of
   done, and what it must never sign off on.
3. `.sdd/checklists/<owning-role>.md` — what the reviewer will actually work
   through.
4. The artifact named for the stage, plus everything in the role's `reads:`
   list.

Check `.sdd/overrides/` first for each of these — an override shadows the
shipped file, and the team put it there on purpose.

## Step 3 — do the work

Work as that role, on that artifact. Concretely:

- Fill the sections the role `owns`. Leave other roles' sections alone, even if
  you can see what they should say — writing into someone else's section is how
  ownership dissolves.
- Replace `TODO(sdd)` markers with real content. Anything you genuinely cannot
  answer stays a `TODO(sdd)` and gets raised as an open question. A placeholder
  survives sign-off in exactly no circumstances: `check` fails on it.
- Follow the role's ordered steps rather than your own instinct about what the
  document needs.

## Step 4 — report, do not self-approve

Tell the user what you changed and what the checklist still needs from a human.
Then stop.

**Do not run `fleet-sdd gate ... approve`.** A gate is a person accepting
accountability. Offer the command for them to run:

```
fleet-sdd gate <gate-id> approve -m "<what was reviewed>"
```

If several gates block the stage, work the first one, report, and let the user
decide whether to continue. Working all of them at once produces a large diff
nobody reviews properly.
