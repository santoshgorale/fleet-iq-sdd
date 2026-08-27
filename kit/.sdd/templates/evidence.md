# {{TITLE}} — evidence

> `{{FEATURE_ID}}` · created {{DATE}}
>
> **Proof.** Not intentions. Every claim here should name what was run, where,
> against what data, and what happened — including the things that failed.

## Implementation

> Owned by the Developer — gate `build.implementation`.

- **Built:** TODO(sdd)
- **Tested:** TODO(sdd)
- **Deliberately not covered:** TODO(sdd) The most valuable line in this file.
- **Look closely at:** TODO(sdd) Where a reviewer's attention is best spent.
- **Design deviations:** TODO(sdd) And confirmation that `design.md` was updated.

## Pipeline

> Owned by the DevOps Engineer — gate `build.pipeline`.

| Check | Runs on | Blocks a merge? |
| --- | --- | --- |
| TODO(sdd) | | |

A scan that reports but never fails a build is documentation, not a control.
Say which is which.

## Functional verification

> Owned by the QA Engineer — gate `prove.functional`.

- **Environment:** TODO(sdd)
- **Test data:** TODO(sdd)

| Criterion | Result | Notes |
| --- | --- | --- |
| AC1 | TODO(sdd) | |

**UX states exercised**

| State | Result |
| --- | --- |
| Empty | TODO(sdd) |
| Loading | |
| Partial data | |
| Error | |
| Permission denied | |
| Offline | |

**Failure modes triggered**

| Failure mode from design.md | How it was induced | Behaviour observed |
| --- | --- | --- |
| TODO(sdd) | | |

**Defects raised**

| ID | Criterion violated | Reproduction |
| --- | --- | --- |
| | | |

## Security verification

> Owned by the Security Engineer — gate `prove.security`.

| Mitigation from design.md | How it was verified | Result |
| --- | --- | --- |
| TODO(sdd) | | |

- **Attempts that failed to break it:** TODO(sdd) Negative results are evidence.
- **Accepted residual risk:** TODO(sdd)

## Performance verification

> Owned by the Performance Engineer — gate `prove.performance`.

- **Method:** TODO(sdd) Tool, duration, ramp.
- **Environment:** TODO(sdd) And how it differs from production.
- **Dataset size:** TODO(sdd) Must be at least production-realistic.

| Operation | Budget | Measured | Pass? |
| --- | --- | --- | --- |
| TODO(sdd) | | | |

## Observability verification

> Owned by the Observability Engineer — gate `operate.monitoring`.

| Alert | Exists | Deliberately fired | Routed to | Runbook link resolves |
| --- | --- | --- | --- | --- |
| TODO(sdd) | | | | |

- **Dashboards live:** TODO(sdd) With links.
- **Correlation id verified end to end:** TODO(sdd)
- **Cardinality impact measured:** TODO(sdd)

An alert nobody has seen fire is a belief, not a control.

## Test summary

> Owned by the Test Lead — gates `prove.regression` and the release
> recommendation.

- **Tested:** TODO(sdd)
- **Passed:** TODO(sdd)
- **Failed:** TODO(sdd)
- **Still open:** TODO(sdd)
- **Regression scope executed:** TODO(sdd)
- **Residual risk:** TODO(sdd) State it plainly; do not hide it behind
  aggregate numbers.
- **Recommendation:** TODO(sdd) Ship / ship with conditions / do not ship.
