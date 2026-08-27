# Checklist — Observability Engineer

Two gates, checked separately.

## `design.observability` — designed before it is built

### Signals
- [ ] Every SLI ties to something a user would notice
- [ ] Every performance budget in `design.md` has a matching SLI
- [ ] Every success measure in `spec.md` has a matching SLI
- [ ] Each SLI names where it is emitted from, and its unit
- [ ] Each SLO has a target and a measurement window

### Alerts
- [ ] Each alert has a condition, threshold, evaluation window and severity
- [ ] Each alert names the rota it pages, not a person
- [ ] Each alert has a documented **first action**
- [ ] Alerts fire on symptoms users notice, not on causes like CPU
- [ ] Nothing pages for a condition that resolves itself

### Dashboards
- [ ] Each panel answers a stated question
- [ ] A responder can find the broken thing in well under a minute
- [ ] No panels included merely because the metric exists

### Logs, traces, cost
- [ ] Correlation identifier defined and threaded through every hop
- [ ] Events worth recording listed, with fields and sampling rate
- [ ] New label values are bounded — no user ids, request ids or raw paths
- [ ] No personal data in any log line, metric label or trace attribute
- [ ] Cardinality and cost impact estimated

## `operate.monitoring` — verified before release
- [ ] Every designed alert actually exists in the monitoring system
- [ ] Every alert has been **deliberately triggered** and observed to route
- [ ] Every alert's runbook link resolves to real instructions
- [ ] Dashboards are live, and linked from `runbook.md`
- [ ] Correlation id verified end to end on a real request
- [ ] Actual cardinality measured against the estimate
- [ ] "Signals that are normal" written up in `runbook.md`

## `operate.detection` — bug fixes only
- [ ] Answered: would existing monitoring have caught this?
- [ ] If not, the missing signal is named
- [ ] The detection gap is closed as part of this fix, or explicitly waived
