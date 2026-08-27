# Fleet SDD framework — evidence

> `000-fleet-sdd-framework` · created 2026-08-21

## Implementation

- **Built:** T1–T22. Nine CLI commands, the YAML subset parser, thirteen roles,
  three flows, three tiers, six templates, thirteen checklists, three editor
  adapters, the Jira adapter, 43 tests, seven documents, one worked example and
  this spec.
- **Tested:** 43 tests — 9 on the parser, 4 on install and upgrade, 9 on the
  lifecycle, 5 on `check`'s failure cases, 4 on extensibility, 8 on doctor and
  adapters, 4 on the bundled specs. All drive the real CLI against real installs
  in temporary directories.
- **Deliberately not covered:**
  - `sync --apply` against a live Jira. Needs credentials, and creating real
    issues from a test suite is worse than the gap. Payload construction and the
    table round-trip *are* tested.
  - Claude Code slash-command resolution. Cannot be driven from Node; verified
    by hand.
  - The `spike` flow end to end. Its stages use the same machinery as `feature`,
    which is covered.
- **Look closely at:** `install.mjs`. The four-case decision (missing /
  identical / manifest-matched / locally modified) is the only place the tool can
  destroy work, and the LF normalisation in `sha256` is what stops every Windows
  checkout reporting the whole kit as edited. Both are easy to "simplify" wrongly.
- **Design deviations:** two, both reconciled into `design.md` before sign-off.
  (1) Tiers originally listed their artifacts; changed to deriving artifacts from
  required gates after the coupling to the `feature` flow surfaced. (2) `engines`
  relaxed from `>=18` to `>=16` once `fetch` was isolated behind a guard and the
  recursive `readdirSync` in `doctor` was replaced with the existing `walk`.

## Pipeline

| Check | Runs on | Blocks a merge? |
| --- | --- | --- |
| `npm test` | Every push | Yes — 43 tests, about 4 s |
| `fleet-sdd check` on a fresh install of the kit | Every push | Yes — inside the test suite |
| `fleet-sdd check` on the bundled specs | Every push | Yes — inside the test suite |
| Node 16 and Node 20 matrix | Every push | Yes |
| Dependency audit | n/a | There are no dependencies to audit |

The pipeline is short because the surface is small. Notably, the kit validating
*itself* is a merge blocker: a gate added to a flow without an owning role is
caught before it reaches anyone.

## Functional verification

- **Environment:** Windows 11 / Node 16.20.2 during development; Node 20 in CI.
- **Test data:** generated per test in `fs.mkdtempSync` directories.

| Criterion | Result | Notes |
| --- | --- | --- |
| AC1 one command reports stage, artifact, gates, owners | Pass | `next` prints stage, artifact path, each blocking gate, owning role and checklist |
| AC2 new role, no code change | Pass | `data-engineer` added as one file; appeared in `roles`, validated by `check`, routed to by `next` |
| AC3 placeholder enforcement | Pass | Both frame gates approved with `spec.md` untouched → exit 1, listing eight line numbers |
| AC4 ledger validation | Pass | Verified for unknown status, undeclared gate, waiver without reason, approval without owner, missing required gate |
| AC5 upgrade preserves local edits | Pass | Edited `constitution.md`, re-ran `init` → content intact, `.new` written, conflict reported |
| AC6 content outside the block survives | Pass | Appended to `AGENTS.md`, re-ran `init` → text intact |
| AC7 overrides shadow and survive | Pass | `overrides/roles/architect.md` won, showed `[override]`, untouched by `init` |
| AC8 specialists gate at design time | Pass | `design.security`, `design.performance`, `design.observability` all in the `shape` stage |
| AC9 monitoring and support gated before release | Pass | `operate.monitoring` and `operate.support-readiness` both precede `operate.release` |
| AC10 zero dependencies, Node 16 | Pass | `dependencies: {}`; suite green on 16.20.2 |
| AC11 artifacts readable without tooling | Pass | Worked example reviewed as plain Markdown |
| AC12 tiers are flow-agnostic | Pass | `tiny` on `feature` produced spec/tasks/evidence and four gates; no `design.md` or `runbook.md` |

**UX states exercised**

| State | Result |
| --- | --- |
| No `.sdd/` in the repo | Pass — "Run `npx fleet-sdd init` first", exit 1 |
| No features yet | Pass — names the specs dir and the `new` command |
| Several features, none current | Pass — lists them, asks for a name |
| Ambiguous feature name | Pass — lists every match |
| Gate unowned by any role | Pass — `UNOWNED` in red, and `check` errors |
| All gates cleared | Pass — "This feature is done." |
| Gate cleared out of order | Pass — warning naming the gate and stage |

**Failure modes triggered**

| Failure mode from design.md | How it was induced | Behaviour observed |
| --- | --- | --- |
| Missing `config.yml` | Ran `next` in an empty directory | Clear message, exit 1, no stack trace |
| Corrupt `gates.yml` | Injected an unknown status and an undeclared gate | Both named with the file, exit 1 |
| Flow references a missing role | Replaced `roles:` with `[ghost]` | `check` named the file and `ghost`, exit 1 |
| Node under 18 for `sync --apply` | Ran on Node 16 | Refused with a version message rather than "fetch is not defined" |
| Unknown tracker provider | `sync trello` | Refused, pointing at the adapter contract in the docs |

**Edge cases beyond the spec**

Running `init` twice with no changes (all `unchanged`, manifest rewritten);
`init` into a repo with a pre-existing `AGENTS.md` that has no markers (block
appended, nothing lost); a feature name matching two directories (both listed);
`gate` on an id the flow does not declare (refused, lists valid gates); `waive`
with no `-m` (refused before writing); a role owning no gates (warning, not an
error).

**Defects raised**

| ID | Criterion violated | Reproduction |
| --- | --- | --- |
| DEF-1 | AC10 | Parser threw on a plain-scalar sequence item (`- architect`). Fixed: `parseBlock` now treats a line with no top-level key as a scalar. |
| DEF-2 | AC10 | Parser silently dropped every key after a folded scalar (`description: >-`), so all three flows reported "declares no stages". Fixed by adding block scalar support. Found by running the shipped kit through `check` — not by a unit test, which is why that check is now in the suite. |
| DEF-3 | AC1 | Status column misaligned because padding was applied after ANSI colouring. Fixed; noted in `AGENTS.md` as a convention. |
| DEF-4 | AC10 | `doctor` used `readdirSync(..., {recursive: true})`, which needs Node 18.17. Replaced with the existing `walk`. |
| DEF-5 | AC12 | Tier `tiny` on the `spike` flow demanded a `tasks.md` that flow never produces. Fixed by deriving artifacts from required gates. |
| DEF-6 | — | `sync` counted blank template rows as "already linked". Fixed to distinguish linked from not-ready. |

All six fixed. DEF-2 is the instructive one: the unit tests passed while every
shipped flow was silently broken, because no test had yet run the real kit
through `check`. That test now exists and blocks merges.

## Security verification

| Mitigation from design.md | How it was verified | Result |
| --- | --- | --- |
| `init` never overwrites a modified file | Edited two kit files, re-ran `init` | Both preserved, `.new` written, conflict reported. Pass. |
| Content outside marked blocks survives | Appended to `AGENTS.md`, re-ran `init` | Intact. Pass. |
| Sign-offs are attributable | Approved a gate with `SDD_USER` set | `by` and `at` recorded; `check` fails without `by`. Pass. |
| Credentials from environment only | Read the source; ran `sync` with no credentials set | Dry run completed, no network call, no credential read from `config.yml`. Pass. |
| No credential logging | Reviewed `jira.mjs` output paths | Payloads printed; the Basic auth header is constructed at call time and never logged. Pass. |
| No shell interpolation | Created a feature titled `"; rm -rf /"` | Slugified to `rm-rf`; no shell involved. `execFileSync` with a fixed argument list is the only subprocess. Pass. |

- **Attempts that failed to break it:** a feature title with path traversal
  (`../../etc/passwd` → slugified, contained); a `checklist:` path pointing
  outside `.sdd/` (resolved under `.sdd/`, reported missing rather than read);
  a `gates.yml` with a duplicate gate key (last value wins, deterministically);
  a role id not matching its filename (`check` errors rather than accepting it).
- **Accepted residual risk:** anyone who can commit can edit `gates.yml`. The
  ledger is a record of decisions, not an access-control system — git history and
  pull-request review are the control. Stated explicitly in `design.md` so this
  is never mistaken for authentication.

## Performance verification

- **Method:** each command run 20 times on a populated install; wall clock.
- **Environment:** Windows 11, Node 16.20.2, SSD. Slower than a CI runner, so
  these are conservative.
- **Dataset size:** 14 roles, 3 flows, 3 features — then re-checked with 50
  synthetic features to test the stated volume.

| Operation | Budget | Measured | Pass? |
| --- | --- | --- | --- |
| `next` | 300 ms p95 | ~110 ms | Pass |
| `check` (whole repo, 3 features) | 1500 ms p95 | ~180 ms | Pass |
| `check` (50 synthetic features) | 1500 ms p95 | ~610 ms | Pass |
| `init` (full kit, one adapter) | 2000 ms p95 | ~340 ms | Pass |
| `npm test` | 30 s max | ~4 s | Pass |

Reading every `.sdd/*.md` on each invocation is the hot path and it is
comfortably cheap — which is what makes registration-free discovery affordable
rather than merely elegant.

## Observability verification

| Alert | Exists | Deliberately fired | Routed to | Runbook link resolves |
| --- | --- | --- | --- | --- |
| Test suite red | Yes — `npm test` exit 1 | Yes — broke an assertion on purpose | Maintainer, via CI | Yes |
| Kit fails its own check | Yes — in the suite | Yes — added a gate to a flow with no owning role | Maintainer, via CI | Yes |
| Example drifts | Yes — in the suite | Yes — removed a required gate from the example ledger | Maintainer, via CI | Yes |

- **Dashboards live:** `fleet-sdd doctor` and `fleet-sdd status` are the
  dashboards. Both verified against an install with local edits, an override and
  an unmerged `.new` file — all three were reported.
- **Correlation id:** not applicable; single synchronous process.
- **Cardinality impact:** zero. No metrics, no telemetry, no phone-home. A tool
  that tells teams to minimise personal data in telemetry cannot collect any
  itself.

The "kit fails its own check" alert is the one that earned its place — it is what
would have caught DEF-2 on the first commit instead of after three flows had been
written against a broken parser.

## Test summary

- **Tested:** all 12 acceptance criteria, all 7 CLI states, all 5 documented
  failure modes, 6 security mitigations, 5 performance budgets, and the 3
  self-checks.
- **Passed:** all 12 acceptance criteria. All budgets, with wide headroom. All
  43 tests green on Node 16.20.2.
- **Failed:** DEF-1 through DEF-6 during development; all six fixed and
  retested.
- **Still open:** none.
- **Regression scope executed:** the shipped kit passes `check` on a fresh
  install; the worked example and this spec both pass; the suite runs on Node 16
  and Node 20.
- **Residual risk:** three items. (1) The YAML parser is a subset, so an
  unsupported construct in a hand-written `.sdd/` file surfaces as a parse error
  rather than being handled — mitigated by throwing with the file and the
  offending line. (2) `sync --apply` is untested against a live Jira. (3) The
  ledger is attributable, not authenticated; git review is the control.
- **Recommendation:** **ship.** Every criterion is met with evidence, the
  framework validates its own kit and its own spec in CI, and the two riskiest
  mechanisms — the parser and the upgrade path — have negative tests rather than
  only happy ones.
