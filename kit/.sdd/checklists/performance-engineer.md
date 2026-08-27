# Checklist — Performance Engineer

## `design.performance` — budgets before code
- [ ] Every user-visible operation has a budget
- [ ] Each budget states a percentile, not an average
- [ ] Each budget states the conditions it holds under
- [ ] Expected load written down: requests/sec, concurrency, payload sizes
- [ ] The source of those load numbers is stated
- [ ] Hot paths identified, with why they dominate
- [ ] Largest *realistic* data volume stated, not the average
- [ ] Capacity and cost impact estimated
- [ ] Degradation strategy exists — what gives way first under load
- [ ] Budgets handed to Observability so each becomes a monitored SLI

## `prove.performance` — measured, not assumed
- [ ] Method recorded: tool, duration, ramp profile
- [ ] Environment recorded, including how it differs from production
- [ ] Dataset at least production-realistic in size
- [ ] Every budget has a measured number against it
- [ ] Pass or fail stated explicitly per budget
- [ ] Results are not from a developer machine
- [ ] Degradation behaviour actually exercised under load
- [ ] Any budget missed is either fixed or accepted in writing
