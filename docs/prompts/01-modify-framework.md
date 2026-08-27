# Prompt: modify the framework

Use this when changing Fleet SDD itself — a new role, a new gate, a stage, a
validator, a CLI command, an adapter. Fill in the two bracketed sections and hand
it to an agent, or work through it yourself.

Most changes do not need this. **Adding a role, flow, checklist, tier or tracker
adapter to your own team's install is not modifying the framework** — that is
using it as designed, and [authoring-roles.md](../authoring-roles.md) is the
guide. Reach for this file when you are changing what ships in `kit/` or the
behaviour in `cli/`.

---

## The prompt

````markdown
You are changing Fleet SDD, a spec-driven development framework. Read these
before writing anything:

1. `docs/prompts/00-original-brief.md` — what was originally commissioned, and
   the four judgement calls nobody asked for. If your change reverses one of
   those, say so explicitly rather than quietly.
2. `docs/DESIGN.md` — the four failure modes the framework exists to prevent,
   and the five rules that govern the code.
3. `docs/decisions.md` — fourteen decisions with their reasoning and the
   alternatives rejected. Check whether your change was already considered and
   turned down. If it was, argue against the recorded reason rather than
   restating the idea.
4. `AGENTS.md` — repo layout and conventions.

## What I want changed

[DESCRIBE THE CHANGE — be concrete about the behaviour, not the implementation]

## Why

[THE PROBLEM THIS SOLVES. If it comes from real use — a gate that keeps getting
waived, a role nobody could route work to, a validator that fired wrongly — say
so. That is the strongest kind of reason and it belongs in the decision log.]

## Invariants — breaking any of these turns the framework back into the thing it
## replaced

1. **Zero runtime dependencies.** Node built-ins only. `package.json` has empty
   `dependencies` and `devDependencies`, and a test enforces it. If something
   seems to need a library, it probably needs less code.
2. **Discovery over registration.** Never require editing an index to add a role,
   flow, checklist or adapter.
3. **The CLI never owns semantics.** Prompts, checklists and rules live in
   `kit/.sdd/*.md`. `cli/` only globs, validates and reports. If you want to add
   logic to `cli/` to express something about *process*, it belongs in a role or
   flow file instead.
4. **Idempotent install.** Running `init` twice must never destroy work.
5. **Cross-platform.** `node:path` throughout, LF endings, hashes computed on
   normalised content. Node 16 must stay green; only `sync --apply` may assume 18.
6. **Three concepts.** Artifact, role, flow. Adding a fourth is a design failure,
   not a feature.
7. **Agents never sign gates.** Every adapter says so. A gate is a person
   accepting accountability; automating it keeps the ceremony and removes the
   substance.
8. **Roles own sections, not documents.** Do not add a per-role artifact. That
   was BMAD's model and it reintroduces the drift the framework exists to prevent.

## Before you claim to be done

Run all of these:

```bash
npm test                      # must be green; add a test for any new
                              # validator, command or behaviour
npm run diagrams              # regenerate; a flow change changes lifecycle.svg
node cli/sdd.mjs init --into <scratch-dir>
cd <scratch-dir> && node <repo>/cli/sdd.mjs check   # the kit must validate itself
```

Then check the documentation that goes stale most often:

- `docs/decisions.md` — **add an entry.** Date, decision, why, what was
  rejected, newest first. A change to the framework's shape without one is
  incomplete: the next person inherits the behaviour but not the reason, and
  then either preserves a constraint that no longer applies or removes one that
  still does.
- `docs/lifecycle.md` and `docs/roles.md` — do they still describe reality?
- `README.md` — the role table, the flow description, the counts.
- `examples/specs/001-driver-scorecard/` and
  `docs/specs/000-fleet-sdd-framework/` — both must still pass `check`. If a
  schema change broke them, **fix the example, not the validator** — the example
  is the documentation.
- `kit/.sdd/EXTENDING.md` — it ships inside every install, so it is the copy
  most teams actually read.

## Report honestly

Tell me what you changed, what you did **not** cover, and anything you found
that belongs to a different change. If you disagree with an invariant above,
say so plainly and make the case — do not work around it silently.
````

---

## Common changes, and what each touches

| Change | Touches | Watch out for |
| --- | --- | --- |
| Add a role to the kit | `kit/.sdd/roles/`, `kit/.sdd/checklists/`, a flow stage, `docs/roles.md`, README role table | `check` warns if the role owns no gates — that means `next` can never route work to it |
| Add a gate | A role's `gates:`, a flow stage's `gates:` | Existing feature ledgers will be flagged as missing it. There is deliberately no backfill |
| Add or reorder a stage | `kit/.sdd/flows/`, `docs/lifecycle.md`, `npm run diagrams` | `lifecycle.svg` is generated; the staleness test will catch you forgetting |
| Add an artifact | `kit/.sdd/templates/`, the stage that produces it | Required artifacts are *derived* from required gates — do not list them per tier |
| Add a validator | `cli/lib/check.mjs`, a negative test | A validator that guesses is worse than none, because people trust it. Name the file and the fix in the message |
| Add a CLI command | `cli/sdd.mjs`, the `HELP` text, a test | Errors a user could hit are `SddError` (no stack trace); anything else is a bug and should throw loudly |
| Change output formatting | `cli/sdd.mjs` | **Pad before colouring.** ANSI codes count toward string length, and getting it backwards silently breaks every aligned column |
| Change the YAML parser | `cli/lib/yaml.mjs`, unit tests | Unit tests passed once while all three shipped flows were broken. Always also run `check` against a fresh install |
| Change install or upgrade | `cli/lib/install.mjs` | The only place the tool can destroy work. The four-case decision and the LF normalisation in `sha256` both matter more than they look |

## Two lessons from the build worth not relearning

**Test the real thing, not a model of it.** The YAML parser's unit tests were
green while every shipped flow silently failed to parse, because no test had yet
run the actual kit through `check`. That test now blocks merges. The suite has no
mocks for the same reason — the bugs live in the interaction between parser,
ledger and filesystem, which is exactly what a mock hides.

**If a documentation claim is not executable, fix the code.** The README said you
could add your own tracker adapter while `cmdSync` had `provider !== 'jira'`
hard-coded. The right response was to make the claim true, not to soften it.
