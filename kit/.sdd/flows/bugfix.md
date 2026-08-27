---
id: bugfix
name: Bug fix
description: >-
  A defect with a known reproduction. Skips solution shaping -- if a bug needs
  architecture work it is not a bug, it is a feature with a bad reputation.
stages:
  - id: frame
    name: Establish the defect
    artifact: spec.md
    roles: [product-manager, support-lead, qa-engineer]
    gates: [spec.product, spec.reproduction]

  - id: slice
    name: Plan the fix
    artifact: tasks.md
    roles: [product-owner, tech-lead, test-lead]
    gates: [tasks.scope, tasks.testability]

  - id: build
    name: Fix it
    artifact: evidence.md
    roles: [developer, tech-lead, devops-engineer]
    gates: [build.implementation, build.code-review, build.pipeline]

  - id: prove
    name: Prove it is fixed
    artifact: evidence.md
    roles: [qa-engineer, test-lead]
    gates: [prove.functional, prove.regression]

  - id: operate
    name: Close the loop
    artifact: runbook.md
    roles: [support-lead, observability-engineer]
    gates: [operate.support-readiness, operate.detection]
---

## Why a bug fix still has an operate stage

Two gates, and they earn their place.

`operate.detection` asks the question that stops the same bug arriving twice:
*would monitoring have caught this?* If the answer is no, the fix is incomplete
— add the alert or the metric as part of this work. A defect that reached a
customer undetected is also a monitoring defect.

`operate.support-readiness` closes the loop with the people who fielded it:
update the known-issues list, tell support the fix is out, and retire any
workaround they were handing to customers.

Use tier `tiny` for a one-line fix; the tier trims the gate set to
`spec.product`, `tasks.scope`, `build.code-review` and `prove.functional`.
