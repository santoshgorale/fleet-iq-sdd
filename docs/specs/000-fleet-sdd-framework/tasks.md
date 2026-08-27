# Fleet SDD framework — tasks

> `000-fleet-sdd-framework` · created 2026-08-21

## Tasks

| ID | Task | Role | Size | Status | Key |
| --- | --- | --- | --- | --- | --- |
| T1 | `package.json`, `.gitattributes`, `.gitignore` — LF normalisation from the start | developer | S | done | |
| T2 | `cli/lib/yaml.mjs` — YAML subset parser and block-style emitter | developer | L | done | |
| T3 | `cli/lib/discover.mjs` — `.sdd/` index, override resolution, feature lookup | developer | M | done | |
| T4 | `cli/lib/gates.mjs` — ledger read/write, `computeNext`, identity resolution | developer | M | done | |
| T5 | `cli/lib/check.mjs` — framework and feature validators, placeholder enforcement | developer | M | done | |
| T6 | `cli/lib/install.mjs` — manifest upgrade, marked-block merging | developer | M | done | |
| T7 | `cli/sdd.mjs` — arg parsing, nine commands, colour-safe output | developer | L | done | |
| T8 | `kit/.sdd/config.yml`, `constitution.md`, `EXTENDING.md` | architect | M | done | |
| T9 | Five artifact templates plus `decisions.md`, seeded with placeholder markers | architect | L | done | |
| T10 | Three flows: `feature` (six stages), `bugfix`, `spike` | architect | M | done | |
| T11 | Eleven role files: product, UX, PO, architect, tech lead, developer, test lead, QA, DevOps, security, performance | architect | L | done | |
| T12 | Two further roles: observability and support, plus the `operate` stage | architect | M | done | |
| T13 | Thirteen checklists | architect | L | done | |
| T14 | Claude adapter: six slash commands and the `sdd-review` skill | tech-lead | M | done | |
| T15 | Cursor and Copilot adapters from the same kit | tech-lead | S | done | |
| T16 | `cli/lib/adapters/jira.mjs` — dry-run default, env credentials, key write-back | developer | M | done | |
| T17 | `test/run.mjs` — real installs, no mocks | test-lead | L | done | |
| T18 | `docs/DESIGN.md` and `docs/decisions.md` | architect | M | done | |
| T19 | Five guides: quickstart, lifecycle, roles, authoring, upgrading | architect | L | done | |
| T20 | Worked example: `examples/specs/001-driver-scorecard`, all five artifacts filled | product-manager | L | done | |
| T21 | This spec — the framework in its own format | architect | M | done | |
| T22 | Repo `AGENTS.md` and `CLAUDE.md` pointing at DESIGN and decisions first | tech-lead | S | done | |

## Dependencies

| Task | Depends on | Why |
| --- | --- | --- |
| T3, T4, T5 | T2 | Everything parses front matter |
| T7 | T3–T6 | Commands compose the libraries |
| T10, T13 | T11, T12 | Flows and checklists reference role ids |
| T12 | T10, T11 | The `operate` stage needs its two roles to exist |
| T14, T15 | T8–T13 | Adapters reference `.sdd/` paths |
| T17 | T7 | Tests drive the CLI |
| T20, T21 | T9, T10 | Filled artifacts need templates and a flow |

T2 was sequenced first because it carried the most risk: if a hand-written YAML
subset had proved unworkable, the zero-dependency rule — and with it a
significant part of the design — would have had to be abandoned. Better to find
that out on day one. It surfaced two real gaps (plain scalar sequence items,
then block scalars), both caught by running the shipped kit through `check`.

## Traceability

| Acceptance criterion | Covered by |
| --- | --- |
| AC1 single command reports stage, artifact, gates, owners | T4, T7 |
| AC2 new role with no code change | T3, T11 |
| AC3 placeholder enforcement | T5, T9 |
| AC4 ledger validation | T5 |
| AC5 upgrade never destroys local edits | T6 |
| AC6 content outside the managed block survives | T6 |
| AC7 overrides shadow and survive | T3, T6 |
| AC8 specialists gate at design time | T10, T11, T12 |
| AC9 monitoring and support gated before release | T10, T12 |
| AC10 zero dependencies, Node 16 | T1, T2, T16 |
| AC11 artifacts readable without tooling | T9, T20 |
| AC12 tiers are flow-agnostic | T3, T8 |

Reverse check: T18, T19, T21 and T22 map to no acceptance criterion. They are
documentation obligations, recorded here so they are not mistaken for scope
creep. T20 covers AC11 and doubles as the example a team asks for first.

## Test approach

| Level | What it covers | Why this level |
| --- | --- | --- |
| Unit | YAML parser: block sequences, flow collections, block scalars, comments in quotes, round-trip | Pure functions, many edge cases, and the highest-risk file |
| Integration | Real `init` into a temp directory, then real commands against it | The likely bugs are in the interaction between parser, ledger and filesystem — a mock would hide exactly that |
| Negative | Corrupted ledgers, unknown gates, missing roles, waivers without reasons | A validator is only worth what its failure cases prove |
| Manual | `/sdd:next` and `/sdd:role` inside Claude Code | Slash-command resolution cannot be tested from Node |

- **Test data:** generated in-test. Each test creates its own install via
  `fs.mkdtempSync` and removes it afterwards. No fixtures to drift.
- **Environments:** Node 16 (the development machine) and Node 20. Only
  `sync --apply` may assume Node 18.
- **Regression scope:** the shipped kit must pass `check` on a fresh install
  after any change to `kit/.sdd/`; the worked example and this spec must too.
- **Not being tested:** the Jira `--apply` path against a live instance. Risk
  accepted — it needs credentials, and creating real issues from a test suite is
  worse than the gap. The payload construction and table round-trip are tested.

## External dependencies

None. That is the point.

| What we need | Team | Named person | Needed by | If it slips |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

## Deferred

| Dropped | Reason | Revisit when |
| --- | --- | --- |
| A GitHub Action for `check` | Turning a new process into a merge blocker on day one is how frameworks get resented | The gate set has settled from real use |
| Azure DevOps and GitHub Issues adapters | The contract is documented; one reference implementation is enough to copy | A team asks, or Jira proves insufficient |
| Configurable score-style weighting of gates | No evidence anyone wants gates weighted | Never, probably |
| A `retro` flow | Worth having; not needed to prove the model | After the first quarter of real use |
| Agent-assisted gate approval | Rejected on principle, not deferred — see `decisions.md` | Not planned |
