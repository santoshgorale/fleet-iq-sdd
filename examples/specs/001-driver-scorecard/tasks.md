# Driver scorecard — tasks

> `001-driver-scorecard` · created 2026-08-18

## Tasks

| ID | Task | Role | Size | Status | Key |
| --- | --- | --- | --- | --- | --- |
| T1 | Create `driver_daily_score` table and migration, with the `(fleet_id, date, driver_id)` index | developer | S | done | FIQ-2841 |
| T2 | Nightly rollup job: read telemetry, aggregate per driver-day, idempotent per date | developer | L | done | FIQ-2842 |
| T3 | Backfill 90 days of rollups, run as a one-off with the same code path as T2 | devops-engineer | M | done | FIQ-2843 |
| T4 | Scoring module: penalty model, weights constant, per-100 km normalisation, 100 km floor | developer | M | done | FIQ-2844 |
| T5 | `GET /fleets/{id}/scorecard` — authz, period validation, window sum, deltas | developer | M | done | FIQ-2845 |
| T6 | Response cache keyed on (fleet, period, UTC date) with the 3 s query timeout and stale fallback | developer | M | done | FIQ-2846 |
| T7 | `GET /fleets/{id}/scorecard.csv` with the 5,000-row cap | developer | S | done | FIQ-2847 |
| T8 | Scorecard page: ranked table, period selector, row expansion | developer | L | done | FIQ-2848 |
| T9 | All seven UI states from `spec.md#experience`, including the stale banner | developer | M | done | FIQ-2849 |
| T10 | Accessibility: keyboard path, `aria-sort`, `aria-expanded`, 360 px card layout | developer | M | done | FIQ-2850 |
| T11 | Metrics, log events and the correlation id pass-through | developer | S | done | FIQ-2851 |
| T12 | Five alerts and the scorecard dashboard | observability-engineer | M | done | FIQ-2852 |
| T13 | Extend the driver-deletion job to cover `driver_daily_score` | developer | S | done | FIQ-2853 |
| T14 | Feature flag `scorecard.enabled` and the phased rollout config | devops-engineer | S | done | FIQ-2854 |
| T15 | Load test harness at 500 and 1,340 drivers over 90 days | performance-engineer | M | done | FIQ-2855 |
| T16 | Authorisation test suite: cross-fleet access, no session, revoked grant | qa-engineer | M | done | FIQ-2856 |
| T17 | Runbook: alerts, deploy/rollback, support triage | support-lead | M | done | FIQ-2857 |

## Dependencies

| Task | Depends on | Why |
| --- | --- | --- |
| T3 | T2 | Backfill deliberately reuses the job code path — a separate script would drift |
| T4 | T1 | Scoring reads the rollup shape |
| T5 | T4 | Endpoint serves scores |
| T6, T7 | T5 | Both extend the endpoint |
| T8 | T5 | UI needs a real response |
| T9, T10 | T8 | States and a11y extend the page |
| T12 | T11 | Alerts need the metrics to exist |
| T15 | T5, T3 | Needs the endpoint and realistic data volume |

T1 → T2 → T3 was sequenced first on purpose: the rollup job is the part of the
design most likely to be wrong, and T3 running against production-sized data
proves the AC8 assumption in week one rather than week five.

## Traceability

| Acceptance criterion | Covered by |
| --- | --- |
| AC1 ranked list, 7/30/90 | T5, T8 |
| AC2 four components with raw counts | T4, T8 |
| AC3 normalised per 100 km | T4 |
| AC4 insufficient data under 100 km | T4, T9 |
| AC5 period-on-period delta | T5, T8 |
| AC6 CSV export matches screen | T7, T8 |
| AC7 authorised fleets only | T5, T16 |
| AC8 2 s at p95, 500 drivers, 90 days | T2, T6, T15 |
| AC9 stale data instead of an error | T6, T9 |

Reverse check: every task maps to a criterion except T13 (data deletion,
required by `design.md#security-and-privacy`), T14 (rollout mechanics) and T17
(operability). All three are gate obligations rather than product scope, and are
recorded here so they are not mistaken for scope creep.

## Test approach

| Level | What it covers | Why this level |
| --- | --- | --- |
| Unit | Scoring model, normalisation, 100 km floor, delta with a missing prior window | Pure functions with many edge cases — cheapest place to be exhaustive |
| Integration | Endpoint with a seeded database: authz, period validation, cache, timeout fallback | The interesting bugs are in the interaction between authz, cache and timeout |
| End-to-end | One journey: load → change period → expand → export | Enough to prove wiring; more at this level would be slow and brittle |
| Manual | Accessibility keyboard path, screen reader, 360 px layout, all seven states | States and a11y are judgement calls a test cannot make |

- **Test data:** a generator producing 1,400 drivers × 120 days of synthetic
  telemetry with a controlled event-rate distribution (`tools/gen-telemetry.ts`,
  built as part of T15). Anonymised production shapes were considered and
  rejected — driver behaviour data is employment-sensitive and does not belong in
  a test fixture.
- **Environments:** staging, sized at 40% of production. The load test runs
  against a dedicated instance at full production size for T15; anything measured
  on staging is treated as indicative only.
- **Regression scope:** the Safety navigation section, the shared table
  component (used by four other pages), and the driver-deletion job.
- **Not being tested:** cross-browser beyond Chrome and Safari current; IE and
  Firefox ESR are out of support for this product. Risk accepted — under 0.4% of
  measured sessions.

## External dependencies

| What we need | Team | Named person | Needed by | If it slips |
| --- | --- | --- | --- | --- |
| Read-only DB role on the telemetry replica | Data Platform | Priya R | 2026-08-20 | T2 blocked; rollup cannot run. Mitigation: develop against a local snapshot. |
| Confirmation that 25-month retention is acceptable | Legal | Marcus T | 2026-08-25 | Ship at 13 months to match telemetry, losing year-on-year comparison |

## Deferred

| Dropped | Reason | Revisit when |
| --- | --- | --- |
| Configurable score weightings | Doubles the scoring surface and needs a UI; no account has asked for a specific alternative model yet | Two accounts request the same alternative weighting |
| Driver-facing view | Needs a policy decision on what drivers may see about themselves | Legal and HR guidance exists |
| Fuel and idling components | A different data source and a different audience | Fuel scorecard is scheduled |
| Sortable columns | Ranked-by-score is the job to be done; sorting invites comparison the model does not support | Usage shows managers want another ordering |
