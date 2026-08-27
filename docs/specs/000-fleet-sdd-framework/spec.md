# Fleet SDD framework

> `000-fleet-sdd-framework` · flow `feature` · tier `standard` · created 2026-08-21
>
> The framework described in its own format. This is both the clearest record of
> how Fleet SDD was built and its strongest acceptance test: if it cannot express
> its own construction, it is too rigid.

## Problem

A delivery team spanning thirteen roles does not fail at any one of those jobs.
It fails between them, in four specific ways:

1. Requirements drift from design, and design drifts from tests. Three
   documents, three owners, nothing forcing agreement. Within a quarter nobody
   trusts any of them — and a team that has learned to ignore its documents
   cannot be given new ones.
2. Security, performance, observability and support arrive too late to matter.
   Treated as reviews of finished work rather than inputs to it, so by the time
   they are consulted every cheap option is gone.
3. Nobody can answer "what is blocked and who owns it?" without a meeting. The
   information exists, distributed across people's heads — the one place it
   cannot be queried.
4. Software is handed over unobservable and unsupportable, becoming an on-call
   problem and a ticket queue nobody anticipated.

Four frameworks already address parts of this — spec-kit, BMAD, GSD and
AGENTS.md — and none is small enough that thirteen people will adopt it. BMAD in
particular carries enough ceremony that teams bounce off it.

## Users and jobs

| User | What they are trying to do | Today's friction |
| --- | --- | --- |
| Any of the 13 roles | Know what is expected of them on this feature, now | Asks in a standup, or guesses |
| Product Owner / PM | See what is blocked and who owns it | Convenes a meeting to assemble it |
| Specialist (Sec / Perf / Obs) | Influence a design while it is still cheap to change | Invited to review after the code exists |
| Support Lead | Know what changed before customers ask | Finds out from a ticket |
| A coding agent | Do a role's work correctly without inventing the process | No machine-readable definition of the process |
| Platform team | Let teams extend the framework without a release | Any change is a pull request against someone else's repo |

## Scope

**In scope**

- Three concepts only: artifacts, roles, flows
- Five artifacts per feature plus a machine-readable sign-off ledger
- Thirteen roles as Markdown files, discovered by directory scan
- Three flows: `feature`, `bugfix`, `spike`; three tiers
- A zero-dependency Node CLI: `init`, `new`, `next`, `gate`, `check`, `status`,
  `roles`, `doctor`, `sync`
- Manifest-based safe upgrade, plus an override mechanism
- Adapters for Claude Code, Cursor and Copilot, generated from one kit
- An opt-in, dry-run-by-default Jira adapter

**Out of scope**

- CI enforcement wired by default — `check` exits 1, but nothing is required
- Any server, web UI or database. Git is the store.
- Per-role documents (a separate PRD, UX spec, architecture doc, test plan)
- Agents approving their own gates
- Tracker adapters beyond Jira; the contract is documented instead
- Estimation, capacity planning, sprint mechanics

## Acceptance criteria

| # | Criterion |
| --- | --- |
| AC1 | A single command reports the active stage, the artifact, every blocking gate and its owning role |
| AC2 | A new role is added by creating one Markdown file, with no code change and no registration step |
| AC3 | `check` exits non-zero when a stage is signed off while its artifact still contains an unresolved template placeholder marker |
| AC4 | `check` exits non-zero on a waiver without a reason, an approval without an owner, an undeclared gate, and a gate no role can sign |
| AC5 | Re-running `init` never destroys a locally edited file; the incoming version is written alongside as `<name>.new` |
| AC6 | Content a repo added to `AGENTS.md` outside the managed block survives every upgrade |
| AC7 | `.sdd/overrides/<path>` shadows `.sdd/<path>` and is never modified by an upgrade |
| AC8 | Security, performance and observability hold gates in the design stage, not at release |
| AC9 | The flow includes a stage that gates monitoring and support readiness before release |
| AC10 | The CLI runs with zero third-party dependencies on Node 16 or later |
| AC11 | Every artifact remains readable and reviewable by a person with no AI tooling |
| AC12 | A tier applied to a flow it was not written for produces a sensible artifact and gate set |

## Success measures

| Measure | Baseline today | Target | How it is instrumented |
| --- | --- | --- | --- |
| Time for a new team member to know what to do next | Ask someone | Under 60 seconds, unaided | Observed onboarding |
| Roles added by teams without framework changes | n/a | At least 3 across teams in two quarters | Count of files in `.sdd/roles/` not shipped by the kit |
| Features reaching release with monitoring unverified | Unmeasured, believed common | Zero | `operate.monitoring` waivers in ledgers |
| Design-stage security and performance participation | Late review | Over 90% of standard-tier features | `design.security` / `design.performance` approved before `build.*` |
| Framework upgrades that lose local edits | n/a | Zero | Conflict reports; `.new` files not silently overwritten |

## Experience

The experience is a terminal and a text editor. The design goal is that the
whole framework has one entry point.

### Primary journey

1. A team member finishes something, or picks up work, and runs
   `fleet-sdd next` (or `/sdd:next`).
2. The output names the stage, the artifact, the blocking gate, the owning role
   and the checklist path.
3. They open the role file, work its ordered steps, and fill their sections.
4. They run `fleet-sdd check`.
5. They record a verdict: `fleet-sdd gate <id> approve -m "…"`.
6. The next blocking gate prints automatically.

Onboarding is one sentence: *run `fleet-sdd next` and do what it says.*

### States

| State | What the user sees | What they can do next |
| --- | --- | --- |
| No `.sdd/` in the repo | "No .sdd/ directory found… Run `npx fleet-sdd init` first." | Install |
| No features yet | Where specs live, and the `new` command | Create one |
| Several features, none current | The list, and how to name one | Re-run with a name |
| Ambiguous feature name | Every match | Disambiguate |
| Gate unowned by any role | The gate flagged `UNOWNED` in red | Add a role, or fix the flow |
| All gates cleared | "All required gates are cleared. This feature is done." | Nothing |
| Gate cleared out of order | A warning listing which, and in which stage | Investigate the premature sign-off |

### Accessibility

Terminal output must survive a screen reader and a pipe. Colour is never the
only signal — every status carries its word (`approved`, `pending`,
`changes-requested`). `NO_COLOR` is honoured, and colour is suppressed when
stdout is not a TTY. Padding is applied before colouring so ANSI codes never
distort alignment.

### Content

- Errors state the problem and the next action: "Waiving a gate needs a reason:
  `fleet-sdd gate <id> waive -m "why"`."
- A wrong id lists the valid ones rather than saying "not found".
- `SddError` prints without a stack trace; anything else is a bug and throws
  loudly.

## Known issues

- New gates do not retrofit into existing ledgers. `check` reports the gap; the
  team decides whether to adopt or waive. Deliberate — silent insertion would
  produce a false `pending` on finished work, or worse a false `approved`.
- `sync --apply` needs Node 18 for `fetch`. Everything else runs on Node 16.
- The YAML parser is a subset. Anchors, multi-document streams and complex keys
  are unsupported; it throws a readable error rather than guessing.
- Tier `tiny` on the `spike` flow trims `spike.finding`, which is the point of a
  spike. Documented in the flow file: run spikes at `standard`.
