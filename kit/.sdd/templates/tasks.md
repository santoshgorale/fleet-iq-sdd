# {{TITLE}} — tasks

> `{{FEATURE_ID}}` · created {{DATE}}
>
> **Slices.** Owned by the Product Owner and Tech Lead, with the test approach
> owned by the Test Lead.

## Tasks

Keep the table shape — `fleet-sdd sync` reads it. The `Key` column is filled in
by the tracker adapter; leave it empty and it will be populated on sync.

| ID | Task | Role | Size | Status | Key |
| --- | --- | --- | --- | --- | --- |
| T1 | TODO(sdd) | developer | M | todo | |
| T2 | | | | todo | |

**Size:** S (under a day) · M (1–3 days) · L (needs splitting).
**Status:** todo · doing · done · blocked.

A good task is independently mergeable, names the files or modules it touches,
and states its dependencies.

## Dependencies

| Task | Depends on | Why |
| --- | --- | --- |
| TODO(sdd) | | |

## Traceability

> Owned by the Product Owner — gate `tasks.scope`. The most useful table here.
> Read it both ways: a criterion with no task is a promise nobody is keeping; a
> task with no criterion is scope that arrived without a decision.

| Acceptance criterion | Covered by |
| --- | --- |
| AC1 | TODO(sdd) |

## Test approach

> Owned by the Test Lead — gate `tasks.testability`.

| Level | What it covers | Why this level |
| --- | --- | --- |
| Unit | TODO(sdd) | |
| Integration | | |
| End-to-end | | |
| Manual | | |

- **Test data:** TODO(sdd) What is needed and how it is produced. This is the
  most common hidden blocker in a delivery plan.
- **Environments:** TODO(sdd) What differs from production.
- **Regression scope:** TODO(sdd) Which existing behaviour could this break?
- **Not being tested:** TODO(sdd) And the risk that carries.

## External dependencies

| What we need | Team | Named person | Needed by | If it slips |
| --- | --- | --- | --- | --- |
| | | | | |

## Deferred

Scope explicitly dropped, with the reason. Deferred work that is not written
down comes back as a surprise.

| Dropped | Reason | Revisit when |
| --- | --- | --- |
| | | |
