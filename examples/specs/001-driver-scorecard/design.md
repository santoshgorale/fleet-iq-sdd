# Driver scorecard — design

> `001-driver-scorecard` · created 2026-08-15

## Approach

A nightly batch job aggregates raw telemetry events into a per-driver, per-day
rollup table. The API serves scores by summing rollups over the requested window
and normalising per 100 km. The UI is a React page hitting one endpoint.

Batch rather than on-demand aggregation, because the raw event table holds
~2.4 billion rows and a 90-day window over 500 drivers would scan roughly 40
million of them. The rollup reduces that to 45,000 rows — three orders of
magnitude, and it is the difference between AC8 being achievable and not.

The score is a weighted penalty model. Each component contributes a penalty
proportional to its events per 100 km, capped, and the score is
`100 − Σ penalties`. Weights are constants in one module, not configuration:
v1 ships one model deliberately (see `spec.md` out-of-scope), and a single
module is the cheapest thing to make configurable later.

```
telemetry-events ──▶ nightly rollup job ──▶ driver_daily_score
                                                   │
                              scorecard API ◀──────┘
                                     │
                              scorecard UI
```

## Alternatives considered

| Option | Why it lost |
| --- | --- |
| Compute on demand from raw events | Cannot meet AC8. Measured 11 s for a 500-driver, 90-day window on production-sized data. |
| Stream aggregation into a materialised view | Meets the budget, but adds a streaming dependency the platform does not run today. Revisit if near-real-time becomes a requirement. |
| Precompute the score itself, not the components | Smaller table, but a weighting change would require a full backfill. Storing components keeps the model reversible. |

## Data

| Entity | System of record | Retention | Migration needed |
| --- | --- | --- | --- |
| `telemetry_event` | Telemetry service | 13 months | No |
| `driver_daily_score` | This feature (new table) | 25 months, to allow year-on-year | New table, no backfill beyond 90 days at launch |
| `driver`, `fleet` | Fleet service | n/a | No |

`driver_daily_score` is keyed `(driver_id, date)` with the four component event
counts and distance. Deriving the score at read time from stored components means
a weighting change is a deploy, not a backfill.

## Interfaces

| Interface | Change | Breaking? | Compatibility plan |
| --- | --- | --- | --- |
| `GET /api/v1/fleets/{id}/scorecard?period=30` | New | No | New endpoint |
| `GET /api/v1/fleets/{id}/scorecard.csv` | New | No | New endpoint |
| Telemetry read model | Additive consumer | No | Read-only; no schema change |

Response shape is versioned by the URL. The component list is an array of
objects rather than fixed fields, so adding a fifth component later is additive.

## Failure modes

| Dependency | If it is slow | If it is down | If it returns garbage | Blast radius |
| --- | --- | --- | --- | --- |
| Rollup table | Query timeout at 3 s, serve cached | Serve last cached response with age (AC9) | Row-level validation drops bad rows and increments `scorecard.rows_rejected` | Scorecard only; rest of app unaffected |
| Fleet service (authz) | 1 s timeout, then deny | **Deny** — fail closed | Deny and alert | Users cannot open the scorecard. Correct: never fail open on authorisation. |
| Nightly rollup job | Scores go stale; age shown in UI | Same, plus alert after 26 h | Job aborts on schema mismatch rather than writing partial rollups | Stale scores, no wrong scores |

The consistent choice: **stale is acceptable, wrong is not.** Every degraded path
surfaces the age of the data rather than hiding it.

## Rollout and rollback

- **Rollout:** behind `scorecard.enabled`, default off. Backfill 90 days of
  rollups first, then enable for two internal fleets, then 10% of enterprise
  accounts, then all. Rollup job ships and runs a full week before the UI is
  enabled anywhere.
- **Rollback:** turn off `scorecard.enabled`. The endpoint 404s and the nav item
  disappears. The rollup job and table can stay — they are additive and cost
  ~£12/month in storage. Fully reversible, no migration to undo.

## Security and privacy

- **Assets:** driver behaviour data, which is employment-sensitive; fleet
  membership, which reveals customer structure.
- **Trust boundaries:** browser → API gateway (authenticated session);
  API → fleet service (service credential, authorisation decision); API →
  rollup table (read-only DB role); rollup job → telemetry (read-only).

| Threat | Applies? | Mitigation | Testable how |
| --- | --- | --- | --- |
| Spoofing | Yes | Existing session auth; no new auth path | Request with no session → 401 |
| Tampering | Yes | `period` validated against `{7,30,90}`; `fleet_id` never trusted from the client for authorisation | Fuzz `period`; request another tenant's fleet id |
| Repudiation | Yes | Export logged as `scorecard.exported` with actor, fleet and period | Export, assert audit row |
| Information disclosure | **Yes — primary risk** | Authorisation checked server-side per fleet on every request; no cross-fleet aggregate endpoint | Authenticate as fleet A, request fleet B → 403 |
| Denial of service | Yes | Rate limit 30 req/min/user; CSV capped at 5,000 rows | Exceed limit → 429 |
| Elevation of privilege | Yes | Read-only DB role for the API; no write path from the request handler | Attempt write with API credential |

- **Authorisation:** enforced in the API from the session's fleet grants. The UI
  hiding a fleet is presentation, not enforcement — the endpoint re-checks every
  time.
- **Personal data:** driver name and id, and behaviour metrics. Stored in
  `driver_daily_score` for 25 months, deleted by the existing driver-deletion
  job, which we extend to cover the new table. **Logs and telemetry:** driver id
  is never logged and never used as a metric label; log lines carry `fleet_id`
  and a count only. Export events record the actor, not the driver list.
- **Secrets:** none new. Reuses the existing fleet-service credential from the
  platform secret store, rotated on the existing 90-day cycle.

## Performance

| Operation | Budget | Percentile | Conditions |
| --- | --- | --- | --- |
| Scorecard page load (API) | 2000 ms | p95 | 500 drivers, 90-day period, warm cache |
| Scorecard page load (API) | 3500 ms | p99 | Same, cold cache |
| Row expansion | 150 ms | p95 | Client-side only, no request |
| CSV export | 5000 ms | p95 | 500 drivers, 90 days, 5,000-row cap |
| Nightly rollup job | 45 min | max | 120,000 drivers across all tenants |

- **Expected load:** 41 enterprise accounts, ~8 managers each, peak weekday
  09:00–10:00. Estimated 12 req/s peak, 340 req/min sustained. Derived from
  current Safety-section traffic (measured, dashboard `web-traffic/safety`) times
  a 1.8 adoption factor.
- **Hot paths:** the rollup window sum. 90 days × 500 drivers = 45,000 rows
  aggregated per request; index on `(fleet_id, date, driver_id)` makes this a
  range scan.
- **Largest realistic data volume:** the largest account has 1,340 drivers, not
  the 500 in the median case. Budgets were validated at 1,340 as well — see
  `evidence.md`.
- **Capacity and cost:** rollup table ~9 GB at 25 months; nightly job ~18 min of
  compute. Roughly £40/month all in.
- **Degradation strategy:** in order — 60-second response cache per
  (fleet, period); then pagination at 200 rows; then the 3-second query timeout
  serving cached data with its age. Load shedding returns cached data rather than
  errors, consistent with AC9.

## Observability

### Service level indicators and objectives

| SLI | Emitted from | Unit | SLO | Window |
| --- | --- | --- | --- | --- |
| Scorecard load latency | API handler | ms | p95 < 2000 ms | 28 days |
| Scorecard availability | API handler | ratio of non-5xx | 99.5% | 28 days |
| Score freshness | Rollup job completion | hours since last success | < 26 h, 99% | 28 days |
| Export success rate | API handler | ratio | 99% | 28 days |
| Rows rejected by validation | Rollup job | ratio of rows | < 0.1% | 7 days |

The first two map directly to AC8 and AC9. Freshness exists because the failure
mode users actually notice is not an error page — it is a silently stale number
they then make a coaching decision on.

### Alerts

| Alert | Condition | Threshold | Window | Severity | Routes to | First action |
| --- | --- | --- | --- | --- | --- | --- |
| Scorecard slow | p95 latency | > 2500 ms | 10 min | S3 | fleet-web rota | Open the scorecard dashboard; check cache hit rate, then DB p95 |
| Scorecard failing | 5xx rate | > 2% | 5 min | S2 | fleet-web rota | Check fleet-service health; if authz is timing out, this is fail-closed and expected — confirm upstream |
| Scores stale | Hours since last rollup success | > 26 h | 1 h | S2 | data-platform rota | Check the rollup job log; re-run for the missed date — the job is idempotent |
| Rollup rejecting rows | Rejected ratio | > 1% | 1 run | S3 | data-platform rota | Compare the telemetry event schema against the job's expectations; a producer change is the usual cause |
| Export failures | Export 5xx rate | > 5% | 15 min | S3 | fleet-web rota | Check row counts — most likely the 5,000-row cap being hit legitimately |

Every alert is on a symptom a user would notice. Nothing pages on CPU or memory;
those appear on the dashboard for diagnosis only.

### Dashboards

| Panel | Question it answers |
| --- | --- |
| Scorecard p50/p95/p99 latency | Is it slow, and for everyone or a tail? |
| Cache hit rate | Is degradation from cache misses? |
| Rollup job duration and last success | Are the numbers current? |
| Rows processed vs rejected per run | Did an upstream schema change? |
| 4xx / 5xx split | Is this a permission problem or an outage? |
| Requests by fleet size bucket | Is a large tenant driving the tail? |

### Logs, traces and cardinality

- **Events recorded:** `scorecard.viewed` (fleet_id, period, driver_count,
  duration_ms, cache_hit), `scorecard.exported` (fleet_id, period, row_count,
  actor_id), `rollup.completed` (date, drivers, rows_written, rows_rejected,
  duration_ms). Sampled at 100% — volume is a few thousand a day.
- **Correlation identifier:** existing `X-Request-Id`, propagated to the fleet
  service and included in every log line and span.
- **New metric labels and their bounded values:** `period` ∈ {7, 30, 90};
  `fleet_size_bucket` ∈ {small, medium, large, xlarge}; `cache` ∈ {hit, miss};
  `outcome` ∈ {ok, denied, error, stale}. Maximum 96 new series.
  **No `driver_id` or `fleet_id` as labels** — `fleet_id` has ~41 values today
  but grows with sales, and `driver_id` is both unbounded and personal. Both go
  in log fields, where they are queryable without multiplying series.

## Implementation notes

- Weights live in `scoring/weights.ts` as a single exported constant. One place
  to change, and one place to look when a number is questioned.
- The 100 km minimum (AC4) is checked on summed period distance, not per day —
  a driver working three days a week still scores.
- Deltas compare against the immediately preceding window of equal length. When
  the prior window has no rollup rows at all, return `null` and let the UI show
  "—" rather than fabricating 0.
- The rollup job must be idempotent per date: `DELETE` then `INSERT` inside one
  transaction, so a re-run after a partial failure is safe. The stale-scores
  runbook entry depends on this.
- Cache key is `(fleet_id, period, date_bucket)` where `date_bucket` is the UTC
  date, so the cache self-invalidates daily without a purge step.
