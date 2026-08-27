# Fleet SDD framework — design

> `000-fleet-sdd-framework` · created 2026-08-21
>
> The full rationale lives in [docs/DESIGN.md](../../DESIGN.md); the decision log
> in [docs/decisions.md](../../decisions.md). This file is the design in the
> framework's own format.

## Approach

A **portable kit plus a thin CLI**. `kit/` holds every Markdown and YAML file
that gets copied into a product repo. `cli/` holds logic that only globs,
validates and reports.

The split is the design. Semantics live entirely in `.sdd/*.md`, so a team can
change how the framework behaves without waiting for a release. That is what
"scalable" means here, and it is worth more than any feature.

Three concepts, and deliberately no fourth:

- **Artifact** — five Markdown files plus `gates.yml`, per feature, in git.
- **Role** — one Markdown file with front matter declaring the sections it
  `owns` and the `gates` it may sign.
- **Flow** — ordered stages, each naming an artifact, its roles and its gates.

```
kit/.sdd/  ──(fleet-sdd init)──▶  product-repo/.sdd/
                                        │
                          discover.mjs ─┤─▶ index (roles, flows, config)
                                        │
   docs/specs/<id>/gates.yml ──▶ gates.mjs ──▶ "what is next, and who owns it"
                                        │
                              check.mjs ─▶ exit 0 or 1
```

## Alternatives considered

| Option | Why it lost |
| --- | --- |
| One document per role (BMAD's model) | More faithful to how teams work today, and it reproduces failure #1 — documents with separate owners drift apart. Sections of one file are reviewed in one diff. |
| `js-yaml` for parsing | Better in every respect except the one that mattered. A tool needing `npm install` to read Markdown cannot claim to be lightweight, and it will not survive a locked-down build environment. |
| A `roles:` registry in `config.yml` | Marginally faster to load, and it turns "add a role" into a negotiation with the file's owner. That is how a platform becomes a product. |
| A service with a web UI and a database | Better dashboards. Adds an operational burden to a tool whose only job is reducing burden. |
| Five stages, operability as a release checklist | Simpler. Checklist items with no owner and no gate get skipped under deadline, which is exactly how failure #4 happens. |
| Tiers listing their required artifacts | Read more directly. Silently couples every tier to the `feature` flow — see `decisions.md`, 2026-08-21. |

## Data

| Entity | System of record | Retention | Migration needed |
| --- | --- | --- | --- |
| Role, flow, checklist, template | `.sdd/` in the product repo | Repo lifetime | None; discovered by scan |
| Feature artifacts | `docs/specs/<id>/` | Repo lifetime | None |
| Gate ledger | `<feature>/gates.yml` | Repo lifetime | New gates are reported, never backfilled |
| Install manifest | `.sdd/.manifest.json` | Repo lifetime | Regenerated each `init` |
| Current feature | `.sdd/.current` | Per developer, gitignored | None |

Git is the database. There is no state anywhere else — no cache, no server, no
daemon. That is what makes `git checkout -- .sdd` a complete rollback.

## Interfaces

| Interface | Change | Breaking? | Compatibility plan |
| --- | --- | --- | --- |
| CLI commands | New | No | v1 surface; new commands are additive |
| Role front matter | New | No | Unknown keys ignored, so fields can be added |
| Flow stage schema | New | No | Same |
| `gates.yml` | New | No | Unknown top-level keys preserved on write |
| `syncTracker({...})` | New | No | Documented in `docs/authoring-roles.md` for third-party adapters |

`gates.yml` writes preserve unrecognised top-level fields, so a team can annotate
the ledger without the CLI discarding it.

## Failure modes

| Dependency | If it is slow | If it is down | If it returns garbage | Blast radius |
| --- | --- | --- | --- | --- |
| Filesystem | n/a | Command fails with the OS error | n/a | One command |
| `.sdd/config.yml` | n/a | "`.sdd/config.yml` is missing." | Parser throws with the file and line | All commands; `doctor` still runs |
| A role or flow file | n/a | Role absent from the index | `check` names the file and the problem | `check` fails; `next` may find a gate unowned and says so in red |
| `gates.yml` | n/a | "this does not look like an SDD feature directory" | Parser error naming the file | One feature |
| Jira API | Request hangs | `--apply` fails with the HTTP status and body | Error surfaces the response | `sync` only; `tasks.md` unmodified |
| Node under 18 | n/a | `sync --apply` refused with a version message | n/a | `sync --apply` only |

The consistent choice: **fail loudly and name the file.** A framework whose
validator guesses is worse than one that has none, because people trust it.

## Rollout and rollback

- **Rollout:** `npx fleet-sdd init` per repo. Adapters opt in via
  `--adapters=claude,cursor,copilot`. `--dry-run` reports without writing.
- **Rollback:** everything written is in git under `.sdd/`, `.claude/`,
  `.cursor/`, `.github/`, `docs/specs/`, and the marked blocks of `AGENTS.md`,
  `CLAUDE.md` and `.gitignore`. `git checkout -- .sdd` is a complete revert.

## Security and privacy

- **Assets:** the product repo itself. The CLI writes into a developer's working
  tree, and `sync --apply` reaches an external service on their behalf.
- **Trust boundaries:** kit files → target repo (write); environment → Jira API
  (credentials); `.sdd/` content → agent context (instructions an agent will act
  on).

| Threat | Applies? | Mitigation | Testable how |
| --- | --- | --- | --- |
| Spoofing | No | No authentication surface of its own | n/a |
| Tampering | Yes | `init` never overwrites a modified file; manifest hashes detect edits | Edit a file, re-init, assert content preserved |
| Repudiation | Yes | Every gate records `by` and `at`; `check` fails on an approval without an owner | Approve, assert the ledger fields |
| Information disclosure | Yes | Credentials read from `process.env` only, never from `.sdd/`; never echoed | Grep the source for credential logging |
| Denial of service | No | Local CLI | n/a |
| Elevation of privilege | Yes | No shell interpolation of user input; `git config` is the only subprocess, via `execFileSync` with a fixed argument list | Feature names containing shell metacharacters |

- **Authorisation:** filesystem permissions. A gate sign-off is attributable, not
  authenticated — anyone who can commit can edit `gates.yml`. Git history and
  pull-request review are the control, which is appropriate: the ledger is a
  record of decisions, not an access-control system. Stated here so nobody
  mistakes it for one.
- **Personal data:** the sign-off identity, from `SDD_USER`, `GIT_AUTHOR_EMAIL`
  or `git config user.email`. Written to `gates.yml` and committed — the same
  exposure as a git commit, which the user has already accepted. Nothing else is
  collected, and there is no telemetry of any kind.
- **Secrets:** `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, environment
  only. Reading them from `config.yml` was explicitly rejected: convenient, and
  it puts tokens in git.

## Performance

| Operation | Budget | Percentile | Conditions |
| --- | --- | --- | --- |
| `next` | 300 ms | p95 | 30 roles, 5 flows, 50 features |
| `check` (whole repo) | 1500 ms | p95 | Same |
| `init` | 2000 ms | p95 | Full kit, three adapters |
| Test suite | 30 s | max | 43 tests, real installs in temp directories |

- **Expected load:** a developer running a command a handful of times a day,
  plus `check` in CI. Single-user, single-process.
- **Hot paths:** reading and parsing every `.sdd/*.md` on each invocation. At
  30 roles that is 30 small file reads — trivial, and worth it to keep discovery
  registration-free.
- **Largest realistic data volume:** 50 features × 6 files. `check` reads them
  all; still well inside budget.
- **Capacity and cost:** none. No service.
- **Degradation strategy:** none needed. If a repo ever grew large enough for
  `check` to feel slow, the fix is `check <feature>`, which already exists.

## Observability

Unusual for a local CLI, and the section is short on purpose — instrumenting a
developer tool with telemetry would violate the framework's own privacy
principle. The signals here are the ones a *user* can read.

### Service level indicators and objectives

| SLI | Emitted from | Unit | SLO | Window |
| --- | --- | --- | --- | --- |
| Exit code correctness | `check` | boolean | 100% — errors must exit 1 | per release |
| Test pass rate | `npm test` | ratio | 100% on Node 16 and 20 | per commit |
| Manifest drift detection accuracy | `doctor` | count | Locally edited files reported exactly | per release |

### Alerts

| Alert | Condition | Threshold | Window | Severity | Routes to | First action |
| --- | --- | --- | --- | --- | --- | --- |
| Test suite red | `npm test` fails | any | per commit | S2 | framework maintainer | Read the failing test name; the suite has no mocks, so a failure is a real behaviour change |
| Kit fails its own check | `check` on a fresh install exits 1 | any | per commit | S2 | framework maintainer | The shipped roles and flows are inconsistent — usually a gate added to a flow with no owning role |
| Example drifts | `check` on the bundled specs exits 1 | any | per commit | S3 | framework maintainer | A schema change made the worked example invalid; fix the example, not the validator |

There is deliberately no runtime alerting, because there is deliberately no
runtime.

### Dashboards

| Panel | Question it answers |
| --- | --- |
| `npm test` output | Does it work? |
| `fleet-sdd doctor` | Is this install healthy, and what has been edited locally? |
| `fleet-sdd status` | Where is the work? |

`doctor` and `status` are the dashboards. They exist because the same question —
"what is the state of this?" — needs answering for the install and for the work,
and neither should require reading files by hand.

### Logs, traces and cardinality

- **Events recorded:** none. No telemetry, no phone-home, no usage collection.
  A tool that lectures teams about minimising personal data in telemetry cannot
  collect any itself.
- **Correlation identifier:** not applicable — single process, synchronous.
- **Metric labels:** none.

## Implementation notes

- `cli/lib/yaml.mjs` is the only clever file. It supports block maps, block
  sequences, flow collections, block scalars (`|`, `>`), comments and quoting —
  exactly what `.sdd/` uses. Chomping is always clipped. It throws rather than
  guessing on anything else.
- Sequence tokens are normalised so `- key: value` and a nested block map look
  identical to the parser. One shape, not two.
- Hashes are computed on LF-normalised content so a CRLF checkout on Windows
  does not read as a local edit. This matters: without it, every Windows
  developer would see the entire kit reported as modified.
- `computeNext` walks stages in order and returns the first with uncleared
  required gates. Gates cleared in later stages are reported as out-of-order
  rather than treated as errors — working ahead is fine, claiming completion
  ahead is what needs surfacing.
- Required artifacts are derived from required gates, never listed per tier.
  Keeps tiers flow-agnostic.
- CLI output pads before colouring. ANSI codes count toward string length, and
  getting this backwards silently breaks every aligned column.
- `SddError` is for anything a user could hit; it prints without a stack trace.
  Everything else throws loudly, because it is a bug.
