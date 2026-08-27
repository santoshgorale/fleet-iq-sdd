# Driver scorecard — runbook

> `001-driver-scorecard` · created 2026-08-24
>
> Written for the person woken at 3am and the agent answering the phone at 9am.

## Monitoring and alerting

| Alert | Severity | Means | First action | Escalate to | Dashboard |
| --- | --- | --- | --- | --- | --- |
| Scorecard slow | S3 | p95 over 2.5 s for 10 min | Open the dashboard; check cache hit rate first, then DB p95. A hit rate below 60% usually means a deploy cleared the cache — it recovers in ~5 min. | data-platform if DB p95 is the cause | `grafana/fleet-iq/scorecard` |
| Scorecard failing | S2 | 5xx over 2% for 5 min | Check fleet-service health. If its authz calls are timing out, the scorecard is **failing closed by design** — fix upstream, not here. | platform-oncall | same |
| Scores stale | S2 | No successful rollup for 26 h | Check the rollup job log for the last run. Re-run for the missed date: the job is idempotent per date, so a repeat run is safe. | data-platform lead | `grafana/fleet-iq/rollup` |
| Rollup rejecting rows | S3 | Over 1% of rows rejected in a run | Compare the telemetry event schema against the job's expectations. A producer-side field change is the usual cause. Do **not** lower the threshold to silence it. | telemetry team | same |
| Export failures | S3 | CSV 5xx over 5% for 15 min | Check row counts. Most likely a fleet hitting the 5,000-row cap legitimately — that is a product limit, not an outage. | fleet-web rota | `grafana/fleet-iq/scorecard` |

**Dashboards**

| Dashboard | Link | Use it when |
| --- | --- | --- |
| Scorecard | `grafana/fleet-iq/scorecard` | Any latency, error or export alert |
| Rollup job | `grafana/fleet-iq/rollup` | Staleness or row-rejection alerts |

**Signals that are normal**

- A latency spike for 3–5 minutes after every deploy. The response cache is
  cold. Do not page on it; the alert's 10-minute window is set to ride it out.
- `rows_rejected` between 0 and 0.1% every run. Some telemetry events genuinely
  lack a driver assignment.
- The nightly job runs 02:10–02:35 UTC. Latency during that window is expected
  to rise slightly on the telemetry replica.
- `outcome=denied` at a steady low rate — managers switching between fleets they
  do not all have access to. Not an attack.

## Operations

**Deploy**

```bash
# Standard service deploy. The rollup job ships with the API image.
kubectl -n fleet-iq set image deploy/fleet-api fleet-api=registry/fleet-api:${TAG}
kubectl -n fleet-iq rollout status deploy/fleet-api --timeout=300s

# The feature is flag-gated; deploying does not expose it.
```

**Rollback**

```bash
# Fastest path: turn the feature off. Takes effect within 30 s.
fleetctl flag set scorecard.enabled=false

# Full rollback of the code, if needed:
kubectl -n fleet-iq rollout undo deploy/fleet-api
kubectl -n fleet-iq rollout status deploy/fleet-api --timeout=300s
```

The rollup table and job can be left running during a rollback — they are
additive, cost about £12/month, and leaving them means scores are current when
the flag is turned back on.

Rollback last tested: **2026-08-26**, on staging and on production for the two
internal pilot fleets. Flag-off took 22 s to propagate; `rollout undo` took 95 s.

**Feature flags**

| Flag | Default | Effect when off |
| --- | --- | --- |
| `scorecard.enabled` | `false` | Endpoints return 404; the Safety nav item is hidden. The rollup job still runs. |
| `scorecard.export.enabled` | `true` | Export button hidden, CSV route 404s. Use to disable export alone if it misbehaves. |

**Configuration**

| Setting | Where it lives | Behaviour if absent |
| --- | --- | --- |
| `SCORECARD_QUERY_TIMEOUT_MS` | Service config map | Defaults to 2500 |
| `SCORECARD_CACHE_TTL_S` | Service config map | Defaults to 60 |
| `SCORECARD_CSV_MAX_ROWS` | Service config map | Defaults to 5000 |
| `TELEMETRY_REPLICA_URL` | Platform secret store | **Service fails to start.** Deliberate — a silent fallback to the primary would put analytical load on it. |

**Health**

- **Dependencies that must be healthy first:** telemetry read replica, fleet
  service (authorisation), Postgres primary (rollup writes).
- **Smoke check confirming a good release:**
  ```bash
  curl -sf -H "Authorization: Bearer ${SMOKE_TOKEN}" \
    "${API}/api/v1/fleets/${PILOT_FLEET}/scorecard?period=30" | jq '.drivers | length'
  ```
  Expect a non-zero count and HTTP 200 in under 2 s.
- **Signal that says roll back:** 5xx above 5% for 5 minutes after the flag is
  enabled for a new cohort, or any report of a manager seeing another fleet's
  drivers. The second is a data-exposure event — turn the flag off first, then
  investigate.

## Support

**What customers will ask**

| In their words | What is actually happening | What to tell them |
| --- | --- | --- |
| "Why is my best driver ranked worst?" | The score is per 100 km, so a driver on short urban routes with frequent braking scores worse than a motorway driver with more total distance. Usually correct, occasionally surprising. | Explain the per-100 km normalisation and walk them through the component breakdown. It almost always resolves the question. |
| "This driver has no score." | Under 100 km in the period. | They need at least 100 km in the selected window to score fairly. Suggest a longer period. |
| "The numbers are from yesterday." | Correct — the rollup is nightly. | Scores update overnight. Today's driving appears tomorrow. |
| "My export has different numbers than the screen." | Almost always a different period or fleet selected between viewing and exporting. | Ask which period and fleet the export header shows; it is recorded in the filename. |
| "I can't see fleet X." | No grant for that fleet. | Their administrator controls fleet access; this is not a scorecard setting. |

**Triage**

Ask three things, in order:

1. **Which fleet and which period?** Half of all tickets resolve here — the
   customer is comparing two different views.
2. **Does the page show a staleness banner?** If yes, this is a platform issue,
   not a data issue. Check the status page before escalating.
3. **Is the score missing, or wrong?** *Missing* is almost always the 100 km
   floor and is self-service. *Wrong* means the component breakdown disagrees
   with the customer's expectation, which needs the fleet id, driver id and
   period attached to an escalation.

**Diagnostics an agent can run themselves**

| Check | Where | What it tells you |
| --- | --- | --- |
| Score freshness for an account | Admin console → Fleet → Data health | Whether the nightly rollup ran for this tenant |
| Driver distance in the period | Admin console → Driver → Trips | Whether the 100 km floor explains a missing score |
| Fleet grants for a user | Admin console → Users → Access | Whether a "cannot see fleet" report is a permissions setting |
| Platform status | status.internal | Whether staleness is a known incident |

**Escalation**

| Severity | Means | Team / rota | Channel | Must attach |
| --- | --- | --- | --- | --- |
| S1 | A manager can see a fleet they are not authorised for | security-oncall **and** fleet-web rota | `#sev1` | Account, user id, fleet ids seen, screenshot, timestamp |
| S2 | Scores stale over 24 h for one or more accounts, or the page is down | data-platform rota | `#fleet-iq-support` | Account, fleet id, staleness banner timestamp |
| S3 | A score is disputed as incorrect | fleet-web rota | `#fleet-iq-support` | Fleet id, driver id, period, expected vs shown, component breakdown screenshot |
| S4 | Feature request, e.g. custom weightings | Product backlog | `#fleet-iq-feedback` | Account, the specific weighting they want |

S1 is the one to memorise: a cross-fleet visibility report is a data-exposure
event, not a bug report. Escalate immediately, before further diagnosis.

**Known limitations and workarounds**

| Limitation | Workaround | Mirror into spec.md#known-issues |
| --- | --- | --- |
| Score weightings are fixed | None. Log the requested weighting against the account so Product can see demand. | Yes |
| Shared vehicles without driver ID attribute to the default driver | Customer must enable driver ID assignment on the device. | Yes |
| No delta for a driver's first period | Shows "—". Available next period. | Yes |
| CSV capped at 5,000 rows | No fleet is near this. If one arrives, escalate S3. | Yes |

**Customer-visible messages**

| Message | What it actually means |
| --- | --- |
| "Needs at least 100 km in the period to score fairly." | The 100 km floor. Expected behaviour, not a fault. |
| "Showing scores from 14 hours ago. We are retrying." | The telemetry replica is unreachable; cached data is being served. Platform issue. |
| "We could not load scores just now." | Both live and cached data failed. Escalate S2. |
| "You do not have access to this fleet." | No grant — **or**, rarely, a fleet-service timeout (DEF-4). If the customer insists they had access minutes ago, check the status page before assuming permissions. |

**Enablement**

- Support team briefed on: **2026-08-27**, 30-minute session, recording in the
  support wiki.
- Docs updated: help centre article `driver-scorecard`, including the per-100 km
  explanation, which is the single most-asked question.
- Release note drafted: reviewed by Product on 2026-08-27.
