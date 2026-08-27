# {{TITLE}} — design

> `{{FEATURE_ID}}` · created {{DATE}}
>
> **How.** Owned by the Architect and Tech Lead, with sections owned by
> Security, Performance and Observability. Those three hold gates *here*, at
> design time — that placement is the point.

## Approach

TODO(sdd) The chosen design in a few paragraphs, then a sketch. Prose first:
diagrams age badly without the sentences that explain them.

## Alternatives considered

| Option | Why it lost |
| --- | --- |
| TODO(sdd) | |

A design with no rejected alternative was not a decision.

## Data

| Entity | System of record | Retention | Migration needed |
| --- | --- | --- | --- |
| TODO(sdd) | | | |

## Interfaces

| Interface | Change | Breaking? | Compatibility plan |
| --- | --- | --- | --- |
| TODO(sdd) | | | |

## Failure modes

| Dependency | If it is slow | If it is down | If it returns garbage | Blast radius |
| --- | --- | --- | --- | --- |
| TODO(sdd) | | | | |

## Rollout and rollback

- **Rollout:** TODO(sdd) Flags, phases, migration order.
- **Rollback:** TODO(sdd) How this comes back out. If it cannot, say so here in
  writing and explain why that is acceptable.

## Security and privacy

> Owned by the Security Engineer — gate `design.security`.

- **Assets:** TODO(sdd) What an attacker would want here.
- **Trust boundaries:** TODO(sdd) Every point where data crosses into more
  trusted territory, and what enforces the crossing.

| Threat | Applies? | Mitigation | Testable how |
| --- | --- | --- | --- |
| Spoofing | TODO(sdd) | | |
| Tampering | | | |
| Repudiation | | | |
| Information disclosure | | | |
| Denial of service | | | |
| Elevation of privilege | | | |

- **Authorisation:** TODO(sdd) Who may do what, enforced where. Server-side.
- **Personal data:** TODO(sdd) What is collected, why, where stored, retention,
  deletion. Include logs, metrics and analytics — that is where it leaks.
- **Secrets:** TODO(sdd) What is needed, where it lives, how it rotates.

## Performance

> Owned by the Performance Engineer — gate `design.performance`.

| Operation | Budget | Percentile | Conditions |
| --- | --- | --- | --- |
| TODO(sdd) | | p95 | |

- **Expected load:** TODO(sdd) Requests/sec, concurrency, payload sizes, and
  where those numbers came from.
- **Hot paths:** TODO(sdd)
- **Largest realistic data volume:** TODO(sdd) Not the average — most
  performance defects are a query that is fine at 100 rows.
- **Capacity and cost:** TODO(sdd)
- **Degradation strategy:** TODO(sdd) What gives way first under load.
  Something must, by design.

## Observability

> Owned by the Observability Engineer — gate `design.observability`.
> Every performance budget above should appear here as an SLI.

### Service level indicators and objectives

| SLI | Emitted from | Unit | SLO | Window |
| --- | --- | --- | --- | --- |
| TODO(sdd) | | | | |

### Alerts

| Alert | Condition | Threshold | Window | Severity | Routes to | First action |
| --- | --- | --- | --- | --- | --- | --- |
| TODO(sdd) | | | | | | |

Alert on symptoms users notice, not on causes. An alert with no first action is
a notification, and it belongs in a channel, not a page.

### Dashboards

| Panel | Question it answers |
| --- | --- |
| TODO(sdd) | |

### Logs, traces and cardinality

- **Events worth recording:** TODO(sdd) with their fields and sampling rate.
- **Correlation identifier:** TODO(sdd) The id threaded through every hop.
  Without one, distributed debugging is guesswork.
- **New metric labels and their bounded values:** TODO(sdd) No personal data, no
  raw identifiers — unbounded labels are the standard way to melt a metrics bill.

## Implementation notes

> Owned by the Tech Lead. Decisions resolved here so each developer does not
> invent their own answer.

- TODO(sdd)
