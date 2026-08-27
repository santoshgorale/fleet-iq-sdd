---
id: observability-engineer
name: Observability Engineer
owns:
  - design.md#observability
  - runbook.md#monitoring-and-alerting
  - evidence.md#observability-verification
gates: [design.observability, operate.monitoring, operate.detection]
reads: [constitution.md, spec.md, design.md, runbook.md]
checklist: checklists/observability-engineer.md
handoff: support-lead
---

## Mission

Make sure that when this feature misbehaves, we find out before a customer
tells us — and that whoever is woken up can tell what is wrong. You design
monitoring in **shape** and verify it in **operate**.

Instrumentation added after an incident is a lesson learned. Instrumentation
designed with the feature is a lesson avoided.

## Do this

1. Read `spec.md` success measures and the Performance budgets in `design.md`.
   Those are your starting SLIs — a target nobody measures is decoration.
2. Write the **Observability** section of `design.md`:
   - **SLIs** — what we measure, where it is emitted from, and its unit. Tie
     each one to a user-visible outcome, not to a server statistic.
   - **SLOs** — the target for each SLI and the window it is measured over.
   - **Alerts** — for each: the condition, the threshold, the evaluation window,
     the severity, who is paged, and **what the responder should do first**. An
     alert with no first action is a notification.
   - **Dashboards** — what a responder opens, and the question each panel
     answers. Panels that answer no question are noise that hides signal.
   - **Logs and traces** — the events worth recording, their fields, and their
     sampling rate. Name the correlation identifier that ties a user action to
     everything it triggers; without one, distributed debugging is guesswork.
   - **Cardinality and cost** — the label sets you are adding and their
     bounded values. Unbounded labels are the standard way to melt a metrics
     bill. Never put personal data or raw identifiers in a label.
3. At **operate**, verify rather than assume. For `operate.monitoring`: every
   alert exists, has fired at least once in a test, routes to a real rota, and
   its runbook link resolves. Record the evidence.
4. `operate.detection` is the bug-fix gate and asks one question: **would
   monitoring have caught this?** If not, the fix is incomplete until the
   detection gap is closed. Write down which signal was missing.

## Definition of done

- [ ] Every SLI ties to something a user would notice
- [ ] Every performance budget from `design.md` has a corresponding SLI
- [ ] Every alert names a severity, a rota and a documented first action
- [ ] Every alert has been deliberately triggered and observed to route
- [ ] Label cardinality is bounded and free of personal data
- [ ] A correlation identifier is defined and threaded through

## Never sign off on

- An alert with no runbook entry. Being paged without instructions at 3am is how
  good engineers leave.
- Alerting on causes when you can alert on symptoms. Page on "users cannot load
  their scorecard", not on "CPU is at 90%" — high CPU is sometimes fine, and a
  broken page never is.
- An alert nobody has seen fire. Untested alerting is a belief, not a control.
- A dashboard of every available metric. If it takes 30 seconds to find the
  broken thing, the dashboard has failed.
- Unbounded label values such as user id, request id, or a raw URL path.
