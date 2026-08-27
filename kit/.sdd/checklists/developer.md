# Checklist — Developer (`build.implementation`)

This is you asserting the work is genuinely finished, before anyone else spends
time on it. Be strict here and code review gets cheap.

## Built the right thing
- [ ] Read `spec.md` acceptance criteria and `design.md` before starting
- [ ] Every criterion this task covers actually works
- [ ] Deviations from the design raised and reconciled in `design.md`

## Tests
- [ ] A test per acceptance criterion in scope
- [ ] Failure modes from `design.md` covered
- [ ] Edge cases: empty, maximum, duplicate, concurrent
- [ ] Full suite passes locally — including tests you did not write
- [ ] You verified a test fails when you break the behaviour it covers

## Instrumentation
- [ ] Metrics and log events from `design.md#observability` are emitted
- [ ] Correlation identifier propagated
- [ ] No personal data in logs or metric labels

## Hygiene
- [ ] No commented-out code or debug output
- [ ] No `TODO` without a name and a ticket
- [ ] No secrets in code, config or test fixtures
- [ ] Follows the conventions of the surrounding code, not your preference

## Honest handover
- [ ] `evidence.md#implementation` says what you built and what you tested
- [ ] It also says what you **did not** cover — the most useful line in it
- [ ] It points a reviewer at the parts worth close attention
