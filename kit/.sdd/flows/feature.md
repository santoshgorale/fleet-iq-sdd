---
id: feature
name: Feature delivery
description: >-
  The default path from idea to something running in production that someone can
  support at 2am. Six stages, each with an artifact and gates that must clear
  before the next stage opens.
stages:
  - id: frame
    name: Frame the problem
    artifact: spec.md
    roles: [product-manager, ux-designer]
    gates: [spec.product, spec.ux]

  - id: shape
    name: Shape the solution
    artifact: design.md
    roles:
      - architect
      - tech-lead
      - security-engineer
      - performance-engineer
      - observability-engineer
    gates:
      - design.architecture
      - design.security
      - design.performance
      - design.observability

  - id: slice
    name: Slice the work
    artifact: tasks.md
    roles: [product-owner, tech-lead, test-lead]
    gates: [tasks.scope, tasks.testability]

  - id: build
    name: Build it
    artifact: evidence.md
    roles: [developer, tech-lead, devops-engineer]
    gates: [build.implementation, build.code-review, build.pipeline]

  - id: prove
    name: Prove it works
    artifact: evidence.md
    roles: [qa-engineer, test-lead, security-engineer, performance-engineer]
    gates: [prove.functional, prove.security, prove.performance]

  - id: operate
    name: Make it operable
    artifact: runbook.md
    roles: [observability-engineer, support-lead, devops-engineer]
    gates: [operate.monitoring, operate.support-readiness, operate.release]
---

## Why six stages

Five of them are the familiar spec-driven shape: understand the problem, design
a solution, break it down, build it, verify it. The sixth exists because
software that nobody can observe or support is not finished — it has merely
been handed to someone else as a problem.

## The two rules that make this work

**Security, performance and observability are designed, not inspected.**
They hold gates in `shape`, alongside architecture. A threat model, a latency
budget and an alert design are cheap on a whiteboard and expensive after
release. This is the single largest departure from how most teams sequence
this work.

**Gates open stages, not calendars.** A stage is current when it has gates that
are neither `approved` nor `waived`. Nobody schedules a stage; `fleet-sdd next`
reads the ledger and tells you where the work actually is.

## Working ahead

Stage order is how gates are *evaluated*, not a ban on parallel work. A
developer may prototype during `shape`, and a QA engineer should be writing
test cases during `slice`. What the ledger prevents is *claiming completion*
out of order — `fleet-sdd next` flags a gate cleared ahead of an open stage so
a premature sign-off is visible rather than silent.
