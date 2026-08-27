# Checklist — Product Support Lead (`operate.support-readiness`)

The test for this gate: could a competent agent on their first week handle a
ticket about this feature using only `runbook.md`?

## Questions we will get
- [ ] Top three or four customer questions written in *customer* language
- [ ] Each has a plain-English explanation of what is really happening
- [ ] Each has something the agent can actually say

## Triage
- [ ] An agent can distinguish user error from misconfiguration from a defect
- [ ] What to ask the customer for is listed
- [ ] Diagnostics the agent may run themselves are listed, with where to run them
- [ ] If that list is empty, the gap has been raised rather than accepted quietly

## Escalation
- [ ] Points at a team or rota, never a named individual
- [ ] Channel specified
- [ ] Severity definitions specific to this feature
- [ ] Required attachments listed, so escalations arrive complete

## Expectations
- [ ] Known limitations listed with workarounds
- [ ] Mirrored into `spec.md#known-issues` so Product sees them
- [ ] Every customer-visible error message has an explanation an agent can read out

## Enablement
- [ ] Support team briefed **before** release, with the date recorded
- [ ] Documentation updated
- [ ] Release note drafted and reviewed
- [ ] Alerts that could generate customer contact are known to support

## Bug fixes
- [ ] Any workaround being handed to customers is retired
- [ ] Customers who reported it can be told it is fixed
