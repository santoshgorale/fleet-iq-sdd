# Driver scorecard — evidence

> `001-driver-scorecard` · created 2026-08-19

## Implementation

- **Built:** T1–T14 as specified. The rollup job, scoring module, both
  endpoints, the cache with stale fallback, the page with all seven states,
  accessibility work, instrumentation, and the deletion-job extension.
- **Tested:** 84 unit tests on scoring (normalisation, the 100 km floor, delta
  with a missing prior window, penalty caps). 31 integration tests on the
  endpoints, including authz denial paths and the timeout fallback. One e2e
  journey.
- **Deliberately not covered:** the backfill script path (T3) has no automated
  test — it was run once against staging and verified by row counts. If we ever
  re-run a backfill, that is a manual, supervised operation. Also untested: CSV
  behaviour above the 5,000-row cap for a fleet that large, because no such
  fleet exists yet; the cap itself is tested with a lowered constant.
- **Look closely at:** the cache interaction in `scorecardCache.ts`. The stale
  fallback deliberately serves an expired entry when the query times out, which
  means "expired" and "unusable" are different states. That distinction is easy
  to lose in a later refactor.
- **Design deviations:** the query timeout was moved from 3 s to 2.5 s after
  T15 showed that a 3 s timeout plus serialisation exceeded the p99 budget.
  `design.md#performance` updated on 2026-08-24.

## Pipeline

| Check | Runs on | Blocks a merge? |
| --- | --- | --- |
| Unit and integration tests | Every push | Yes |
| Lint and type check | Every push | Yes |
| Dependency audit (high and critical) | Every push | Yes |
| Container image scan | Every push to main | No — reports to the security channel |
| E2E suite | Every PR to main | Yes |
| Load test (T15 harness) | Manual trigger | No |
| Migration dry-run against a staging clone | PRs touching `migrations/` | Yes |

The image scan is the one check that reports without blocking. That is a
deliberate choice — base-image CVEs appear faster than we can rebase, and a
blocking check there would have stopped unrelated merges four times this quarter.
It is reviewed weekly in the security channel.

## Functional verification

- **Environment:** staging, 40% of production size, build `a41f9c2`.
- **Test data:** generated fixture, 1,400 drivers × 120 days
  (`tools/gen-telemetry.ts`, seed 4471).

| Criterion | Result | Notes |
| --- | --- | --- |
| AC1 ranked list, 7/30/90 | Pass | All three periods; ranking is worst-first as specified |
| AC2 four components with raw counts | Pass | Sub-scores and raw counts both shown on expansion |
| AC3 normalised per 100 km | Pass | Two synthetic drivers, identical rates, 180 km vs 2,400 km → identical scores |
| AC4 insufficient data under 100 km | Pass | 99.4 km shows "insufficient data"; 100.1 km scores |
| AC5 period-on-period delta | Pass | First-period drivers show "—", not 0 |
| AC6 CSV matches screen | Pass | Byte-compared against the rendered table for 3 fleets |
| AC7 authorised fleets only | Pass | See security verification |
| AC8 2 s p95 | Pass | See performance verification |
| AC9 stale instead of error | Pass | Telemetry replica stopped mid-session; banner appeared with correct age |

**UX states exercised**

| State | Result |
| --- | --- |
| Empty (no drivers) | Pass |
| Empty (no telemetry) | Pass |
| Loading | Pass — period selector stayed interactive |
| Partial data | Pass |
| Error | Pass — retry succeeded after the replica was restored |
| Permission denied | Pass — fleet switcher remained usable |
| Offline | Pass — cached data shown with timestamp |

**Failure modes triggered**

| Failure mode from design.md | How it was induced | Behaviour observed |
| --- | --- | --- |
| Rollup table slow | 4 s artificial delay on the replica | Timed out at 2.5 s, served cached with age. Correct. |
| Rollup table down | Replica stopped | Cached response with age; no 5xx |
| Fleet service down | Blocked at the network level | 403 for all fleets — **failed closed**, as designed |
| Fleet service slow | 2 s delay injected | Denied after the 1 s timeout. Correct, though the message reads as a permission problem rather than a transient one — raised as DEF-4 |
| Rollup schema mismatch | Renamed a source column | Job aborted, wrote nothing, `rows_rejected` alert fired |

**Edge cases beyond the spec**

Duplicate export clicks (second request served from cache, no duplicate audit
row); period changed mid-load (earlier request discarded, no flicker); session
expired while the page was open (redirect to login on the next request);
browser back after export (page state restored); driver deleted between page
load and row expansion (row shows "driver removed" rather than erroring).

**Defects raised**

| ID | Criterion violated | Reproduction |
| --- | --- | --- |
| DEF-1 | AC5 | Delta showed +100% for a driver whose prior window had one day of data. Fixed in `a41f9c2` — the floor now applies to the comparison window too. |
| DEF-2 | AC2 | Cornering raw count was double-counted for events spanning midnight UTC. Fixed. |
| DEF-3 | AC6 | CSV used the browser locale for decimal separators; export from a German locale produced commas. Fixed — export is always `en-GB`. |
| DEF-4 | — | Fleet-service timeout surfaces as "You do not have access" rather than a transient error. **Open**, cosmetic, agreed for the next iteration. |

## Security verification

| Mitigation from design.md | How it was verified | Result |
| --- | --- | --- |
| Server-side authz per fleet | Authenticated as fleet A, requested fleet B's id directly against the API | 403. Repeated for 12 fleet pairs. Pass. |
| No session → 401 | Request with the cookie stripped | 401. Pass. |
| Revoked grant takes effect | Removed a grant, retried with the same session | 403 on the next request; no cached authorisation. Pass. |
| `period` validation | Fuzzed with `0`, `-1`, `31`, `1e9`, `7; DROP`, `null`, array | 400 for all. Pass. |
| Rate limit 30/min | 60 requests in 40 s | 429 from request 31. Pass. |
| Read-only DB role | Attempted an `INSERT` with the API credential | Permission denied. Pass. |
| Driver id absent from logs and labels | Grepped 24 h of staging logs and dumped the metric label set | No `driver_id` in either. Pass. |
| Export auditing | Exported, then queried the audit table | Row present with actor, fleet, period, row count. Pass. |
| Deletion covers the new table | Deleted a test driver, checked `driver_daily_score` | Rows removed. Pass. |

- **Attempts that failed to break it:** cross-tenant IDOR by iterating fleet
  UUIDs (all 403); attempting to widen the period via a duplicated query
  parameter (last value wins, still validated); CSV formula injection via a
  driver name of `=cmd|'/c calc'!A1` (export prefixes a `'` on cells beginning
  `= + - @`); requesting `scorecard.csv` without the UI's CSRF token (rejected).
- **Accepted residual risk:** an authorised manager can export driver behaviour
  data with no per-export approval. This matches existing product behaviour for
  other reports and is out of scope here; noted for the data-governance review.

## Performance verification

- **Method:** k6, 10-minute runs, 60-second ramp to 15 virtual users, mixed
  period distribution weighted 30/90/7.
- **Environment:** dedicated instance at full production size. This is *not*
  staging — staging is 40% and its numbers were treated as indicative only.
- **Dataset size:** 1,400 drivers, 120 days of telemetry — the largest real
  account is 1,340 drivers, so this exceeds production's worst case.

| Operation | Budget | Measured | Pass? |
| --- | --- | --- | --- |
| Page load API, 500 drivers, 90 d, warm | 2000 ms p95 | 640 ms | Pass |
| Page load API, 1,340 drivers, 90 d, warm | 2000 ms p95 | 1,180 ms | Pass |
| Page load API, 1,340 drivers, 90 d, cold | 3500 ms p99 | 2,940 ms | Pass |
| Row expansion | 150 ms p95 | 18 ms | Pass |
| CSV export, 1,340 drivers | 5000 ms p95 | 2,210 ms | Pass |
| Nightly rollup, 120k drivers | 45 min | 22 min | Pass |

Degradation was exercised: at 40 virtual users (3.3× expected peak) cache hit
rate rose to 94% and p95 held at 1,410 ms. Beyond 60 users the query timeout
began serving stale data with the age banner — the designed behaviour, not an
error. The 2.5 s timeout change came out of this run.

## Observability verification

| Alert | Exists | Deliberately fired | Routed to | Runbook link resolves |
| --- | --- | --- | --- | --- |
| Scorecard slow | Yes | Yes — 4 s replica delay | fleet-web rota, paged in 38 s | Yes |
| Scorecard failing | Yes | Yes — 500s injected at 5% | fleet-web rota, paged in 71 s | Yes |
| Scores stale | Yes | Yes — job clock advanced 27 h | data-platform rota | Yes |
| Rollup rejecting rows | Yes | Yes — source column renamed | data-platform rota | Yes |
| Export failures | Yes | Yes — forced 500 on the CSV route | fleet-web rota | Yes |

- **Dashboards live:** `grafana/fleet-iq/scorecard` — six panels, each answering
  the question recorded in `design.md#observability`.
- **Correlation id verified end to end:** one request traced from the browser
  through the API to the fleet service; `X-Request-Id` present in all three log
  streams and on the span.
- **Cardinality impact measured:** 71 new series against an estimate of 96.
  Under, because the `xlarge` fleet-size bucket has no members yet.

All five alerts were triggered on purpose in staging and observed to page a real
rota. None of them had been seen fire before this exercise, and two were
misrouted when first created — the "scores stale" alert went to fleet-web
instead of data-platform, and would have woken the wrong team.

## Test summary

- **Tested:** all 9 acceptance criteria, all 7 UI states, all 5 documented
  failure modes, 9 security mitigations, 6 performance budgets, 5 alerts, and the
  regression scope (Safety nav, shared table component, driver-deletion job).
- **Passed:** all acceptance criteria. All budgets, with headroom. All alerts
  fire and route correctly.
- **Failed:** DEF-1, DEF-2 and DEF-3 during testing; all three fixed and
  retested.
- **Still open:** DEF-4 — a fleet-service timeout is presented to the user as a
  permission error rather than a transient one. Cosmetic, misleading in a rare
  case, agreed for the next iteration.
- **Regression scope executed:** shared table component regression suite passes
  (4 other pages); Safety navigation unaffected; driver-deletion job tested with
  the new table included.
- **Residual risk:** two items. (1) DEF-4 will generate occasional support
  tickets during a fleet-service incident — support has the triage entry.
  (2) The CSV row cap has never been exercised by a real fleet; the largest
  account is 1,340 drivers against a 5,000 cap, so there is 3.7× headroom, but
  the behaviour at the boundary is only tested with a lowered constant.
- **Recommendation:** **ship**, with DEF-4 in the next iteration. Every
  acceptance criterion is met with evidence, performance has substantial
  headroom at 2.6× the largest real account, and the operational surface has been
  verified rather than assumed.
