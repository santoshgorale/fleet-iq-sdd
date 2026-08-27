# Roles

Thirteen ship by default. Each is one Markdown file in `.sdd/roles/`, and each
declares the artifact sections it owns and the gates it may sign.

```bash
fleet-sdd roles              # list them
fleet-sdd roles architect    # print one in full
```

## The map

| Role | Owns | Gates |
| --- | --- | --- |
| `product-manager` | `spec.md` | `spec.product` |
| `ux-designer` | `spec.md#experience` | `spec.ux` |
| `architect` | `design.md` | `design.architecture`, `spike.question`, `spike.finding` |
| `security-engineer` | `design.md#security-and-privacy`, `evidence.md#security-verification` | `design.security`, `prove.security` |
| `performance-engineer` | `design.md#performance`, `evidence.md#performance-verification` | `design.performance`, `prove.performance` |
| `observability-engineer` | `design.md#observability`, `runbook.md#monitoring-and-alerting`, `evidence.md#observability-verification` | `design.observability`, `operate.monitoring`, `operate.detection` |
| `product-owner` | `tasks.md` | `tasks.scope` |
| `tech-lead` | `design.md#implementation-notes`, `tasks.md` | `build.code-review` |
| `test-lead` | `tasks.md#test-approach`, `evidence.md#test-summary` | `tasks.testability`, `prove.regression` |
| `developer` | `evidence.md#implementation` | `build.implementation` |
| `qa-engineer` | `evidence.md#functional-verification`, `spec.md#reproduction` | `prove.functional`, `spec.reproduction` |
| `devops-engineer` | `runbook.md#operations`, `evidence.md#pipeline` | `build.pipeline`, `operate.release` |
| `support-lead` | `runbook.md#support`, `spec.md#known-issues` | `operate.support-readiness` |

## By stage

```
frame     product-manager · ux-designer
shape     architect · tech-lead · security · performance · observability
slice     product-owner · tech-lead · test-lead
build     developer · tech-lead · devops
prove     qa · test-lead · security · performance
operate   observability · support-lead · devops
```

Five roles appear in more than one stage. That is intentional: Security and
Performance design *and* verify; the Tech Lead plans *and* reviews; the Test Lead
sets the bar in `slice` and judges against it in `prove`; Observability designs
alerts in `shape` and proves they fire in `operate`.

## What a role file contains

Front matter is the machine-readable contract:

| Field | Means |
| --- | --- |
| `id` | Must match the filename. |
| `name` | Display name. |
| `owns` | Artifact sections this role writes. Everything else is off-limits. |
| `gates` | Gates it may sign. A role with none gets a warning — `next` can never route to it. |
| `reads` | What to load before working. |
| `checklist` | Path under `.sdd/`, e.g. `checklists/architect.md`. |
| `handoff` | Who typically picks up next. Advisory. |

The body has four sections. **Never sign off on** is the sharpest of them —
it catches the things checklists miss, and it is where the real experience in a
role definition lives.

## Mapping to your job titles

The ids are roles, not people. On a small team one person holds several; on a
large one a gate might be a rota.

| If your title is | Read |
| --- | --- |
| Product Manager, Business Analyst | `product-manager` |
| Designer, UX Researcher | `ux-designer` |
| Product Owner, Project Manager, Delivery Manager, Scrum Master | `product-owner` |
| Solution / Enterprise / Software Architect | `architect` |
| Tech Lead, Staff Engineer, Team Lead | `tech-lead` |
| Software Engineer of any seniority | `developer` |
| QA Lead, Test Manager | `test-lead` |
| QA Engineer, SDET | `qa-engineer` |
| DevOps, Platform, Release Engineer | `devops-engineer` |
| AppSec, Security Architect | `security-engineer` |
| Performance Engineer, Capacity Planner | `performance-engineer` |
| SRE, Monitoring / Observability Engineer | `observability-engineer` |
| Support Lead, Customer Success, Service Desk Manager | `support-lead` |

If one person holds two roles, they sign both gates — separately. The point of
the ledger is that each judgement was made, not that a different human made
each one.

## Two roles worth reading even if they are not yours

**`observability-engineer`** holds a gate in `shape`, so alerts are designed
with the feature rather than added after the incident. It also owns
`operate.detection` on bug fixes, which asks the one question that stops a
defect recurring: *would monitoring have caught this?*

**`support-lead`** is the team's cheapest source of truth about what actually
goes wrong in production, and holds a seat in `frame` on bug fixes for exactly
that reason. Its test for `operate.support-readiness` is concrete: could an agent
in their first week handle a ticket about this feature using only `runbook.md`?

## Changing them

Every role file is yours. Edit in place and `init` will preserve it, offering the
new version as `.new`. Or copy it to `.sdd/overrides/roles/<id>.md`, where
upgrades never touch it.

Adding a role is writing a file — no registration, no code. See
[authoring-roles.md](authoring-roles.md).
