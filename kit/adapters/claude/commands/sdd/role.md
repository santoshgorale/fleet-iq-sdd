---
description: Work the current feature as a specific SDD role
argument-hint: "<role-id> [feature-id]"
allowed-tools: Bash(npx fleet-sdd:*), Bash(fleet-sdd:*), Read, Glob, Grep, Edit, Write
---

# /sdd:role

Adopt one role's lens and do its work, regardless of which stage the flow thinks
is current. Use this when you know who you are working as — reviewing a design
as the Security Engineer, say — rather than following the ledger's order.

Arguments: `$ARGUMENTS` — the role id, optionally followed by a feature id.

## Step 1 — load the role

```bash
npx fleet-sdd roles $ARGUMENTS
```

That prints the role's gates, the sections it owns, what it reads, its checklist
and its full body. If the id is wrong it lists the valid ones.

Then find the feature and its state:

```bash
npx fleet-sdd next
```

## Step 2 — read before writing

- `.sdd/constitution.md`
- every artifact in the role's `reads:` list
- `.sdd/checklists/<role>.md`

Check `.sdd/overrides/` for each path first.

## Step 3 — work the role

Stay inside the sections the role `owns`. This is the whole discipline: eleven
roles share four or five files, and that only works because each writes only its
own sections. If another role's section is blocking you, say so — do not fill it
in for them.

Go through the role's **Do this** steps in order, then its **Definition of
done**, then its **Never sign off on** list. That last list is the most useful
part of a role file; treat each line as a question about the work in front of
you.

## Step 4 — report

Summarise:

- what you wrote, section by section
- which checklist items are satisfied, and which need a human
- anything you found that belongs to a different role, named explicitly
- the gate command the user can run if they accept the work

Do not approve gates yourself.
