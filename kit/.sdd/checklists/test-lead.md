# Checklist — Test Lead

## `tasks.testability` — before it is built
- [ ] For every acceptance criterion, you could write a failing test today
- [ ] Ambiguous criteria sent back with the specific gap named
- [ ] Test approach states what is covered at unit, integration, e2e and manual
      level, and why each choice
- [ ] Test data identified, with how it is produced — the usual hidden blocker
- [ ] Environments named, with what differs from production
- [ ] Regression scope defined: which existing behaviour could this break?
- [ ] What is **not** being tested is listed, with the risk it carries

## `prove.regression` and the release recommendation
- [ ] Regression scope actually executed, not just defined
- [ ] QA results read, not summarised second-hand
- [ ] Security and performance evidence reviewed
- [ ] Failure modes from `design.md` were genuinely attempted
- [ ] Every open defect has an impact assessment
- [ ] Residual risk stated plainly, not hidden behind aggregate pass rates
- [ ] An explicit recommendation given: ship / ship with conditions / do not ship
- [ ] You would defend that recommendation if the feature failed next week
