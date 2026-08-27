# {{TITLE}} — runbook

> `{{FEATURE_ID}}` · created {{DATE}}
>
> **Operable.** Written for the person who is woken at 3am and the agent
> answering the phone at 9am — neither of whom was in the design review.
>
> Write it so a competent stranger can act on it. Commands verbatim,
> copy-pasteable, no "obviously".

## Monitoring and alerting

> Owned by the Observability Engineer — gate `operate.monitoring`.

| Alert | Severity | Means | First action | Escalate to | Dashboard |
| --- | --- | --- | --- | --- | --- |
| TODO(sdd) | | | | | |

**Dashboards**

| Dashboard | Link | Use it when |
| --- | --- | --- |
| TODO(sdd) | | |

**Signals that are normal**

TODO(sdd) The spikes and warnings that look alarming but are expected. This
section prevents wasted incident response, and it is the one people forget.

## Operations

> Owned by the DevOps Engineer — gate `operate.release`.

**Deploy**

```bash
TODO(sdd)
```

**Rollback**

```bash
TODO(sdd)
```

Rollback must have been executed at least once, not assumed. Note when it was
last tested: TODO(sdd)

**Feature flags**

| Flag | Default | Effect when off |
| --- | --- | --- |
| TODO(sdd) | | |

**Configuration**

| Setting | Where it lives | Behaviour if absent |
| --- | --- | --- |
| TODO(sdd) | | |

**Health**

- **Dependencies that must be healthy first:** TODO(sdd)
- **Smoke check confirming a good release:** TODO(sdd)
- **Signal that says roll back:** TODO(sdd)

## Support

> Owned by the Product Support Lead — gate `operate.support-readiness`.

**What customers will ask**

| In their words | What is actually happening | What to tell them |
| --- | --- | --- |
| TODO(sdd) | | |

**Triage**

TODO(sdd) How an agent distinguishes user error from a configuration problem
from a genuine defect, and what to ask the customer for.

**Diagnostics an agent can run themselves**

| Check | Where | What it tells you |
| --- | --- | --- |
| TODO(sdd) | | |

If this table is empty, that is a gap in the feature, not a gap in the runbook —
every ticket will escalate.

**Escalation**

| Severity | Means | Team / rota | Channel | Must attach |
| --- | --- | --- | --- | --- |
| TODO(sdd) | | | | |

Point at a rota, never a person. People take holidays.

**Known limitations and workarounds**

| Limitation | Workaround | Mirror into spec.md#known-issues |
| --- | --- | --- |
| TODO(sdd) | | |

**Customer-visible messages**

| Message | What it actually means |
| --- | --- |
| TODO(sdd) | |

**Enablement**

- Support team briefed on: TODO(sdd) *(date)*
- Docs updated: TODO(sdd)
- Release note drafted: TODO(sdd)
