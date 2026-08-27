## Fleet SDD

This repo uses spec-driven development. Feature work lives in
`docs/specs/<nnn-slug>/` as `spec.md`, `design.md`, `tasks.md`, `evidence.md`
and `runbook.md`, with sign-offs recorded in `gates.yml`.

**Before writing code**, run `npx fleet-sdd next`. It reports the active stage,
the artifact in play, the blocking gates and the role that owns each. No
production code without an approved `spec.md` — and beyond tier `tiny`, an
approved `design.md`.

**When editing an artifact**, read `.sdd/roles/<role>.md` first (checking
`.sdd/overrides/` for a local version) and write only into the sections that
role `owns`. Multiple roles share each file; staying in your own sections is
what makes that work.

**Never record a gate sign-off.** `fleet-sdd gate <id> approve` is a person
accepting accountability. Do the work, report it, and leave the command to them.

**Leave `TODO(sdd)` markers** where you do not know the answer. `fleet-sdd check`
fails if one survives a sign-off, which is intentional — an honest gap beats
invented content that reads as settled.

Run `npx fleet-sdd check` before claiming a piece of work is complete.

Roles, flows, checklists and templates are all Markdown under `.sdd/`. See
`.sdd/EXTENDING.md` to add your own.
