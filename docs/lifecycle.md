# Lifecycle

The `feature` flow, stage by stage. `bugfix` and `spike` are shorter paths
through the same machinery.

```
frame ──▶ shape ──▶ slice ──▶ build ──▶ prove ──▶ operate
spec.md   design.md  tasks.md  evidence  evidence  runbook.md
```

A stage is **current** when it has required gates that are neither `approved`
nor `waived`. Nobody schedules a stage; `fleet-sdd next` reads the ledger.

---

## frame → `spec.md`

**Roles:** Product Manager, UX Designer
**Gates:** `spec.product`, `spec.ux`

Establish what problem this solves, for whom, and how we will know it worked.

Product writes the problem with evidence, the users and their jobs, scope *and
out-of-scope*, acceptance criteria, and success measures with a baseline and a
target. UX writes the primary journey and — the part that matters — the empty,
loading, partial, error, permission-denied and offline states, plus accessibility
commitments and the real copy.

**The test for this stage:** could a QA engineer turn every acceptance criterion
into a failing test without asking a question?

## shape → `design.md`

**Roles:** Architect, Tech Lead, Security, Performance, Observability
**Gates:** `design.architecture`, `design.security`, `design.performance`,
`design.observability`

Five gates on one file, and the reason four specialists sign here rather than at
release is the core bet of this framework: **a threat model, a latency budget and
an alert design are cheap on a whiteboard and expensive in production.**

The Architect writes the approach, at least one rejected alternative, the data
model, the interfaces, the failure modes per dependency, and rollout/rollback.
Then marks trust boundaries, hot paths and data flows so the specialists are not
guessing.

Each specialist owns one section:

| Role | Section | Must produce |
| --- | --- | --- |
| Security | Security and privacy | Assets, trust boundaries, threats with testable mitigations, personal-data inventory *including logs and telemetry*, secrets handling |
| Performance | Performance | Budgets with percentiles and conditions, load assumptions and their source, hot paths, largest realistic data volume, degradation strategy |
| Observability | Observability | SLIs tied to user-visible outcomes, SLOs, alerts with severity/rota/**first action**, dashboards where each panel answers a question, correlation id, bounded label cardinality |

Two hand-offs make the stage cohere: every **performance budget** should become
a monitored **SLI**, and every **success measure** from `spec.md` should too. A
target nobody measures is decoration.

## slice → `tasks.md`

**Roles:** Product Owner, Tech Lead, Test Lead
**Gates:** `tasks.scope`, `tasks.testability`

Break the work down, and prove the plan adds up to the promise.

The Product Owner builds the **traceability table** — every acceptance criterion
to at least one task, and every task back to a criterion. Read both ways: a
criterion with no task is a promise nobody is keeping; a task with no criterion
is scope that arrived without a decision.

The Tech Lead makes each task independently mergeable, names the files it
touches, and sequences integration risk early. The Test Lead writes the test
approach and, critically, **where the test data comes from** — the most common
hidden blocker in a delivery plan.

## build → `evidence.md`

**Roles:** Developer, Tech Lead, DevOps
**Gates:** `build.implementation`, `build.code-review`, `build.pipeline`

The Developer signs their own work first: tests written alongside the code,
suite green, design deviations reconciled *into* `design.md`, and an honest note
about **what was not covered**. That last line makes review cheaper than anything
else in the process.

The Tech Lead reviews against the design before reviewing for style — the first
question is "is this what we agreed, and if not, is the deviation better?" DevOps
records what the pipeline actually runs and, separately, what actually **blocks a
merge**. A scan that reports but never fails a build is documentation.

## prove → `evidence.md`

**Roles:** QA, Test Lead, Security, Performance
**Gates:** `prove.functional`, `prove.security`, `prove.performance`

Evidence, not assertion.

QA tests the criteria, then the edges the spec forgot — empty and maximum input,
duplicate submission, concurrent edits, expired session mid-flow, back button,
refresh mid-operation — and deliberately triggers the failure modes named in
`design.md`.

Security verifies each mitigation against the running system, recording what
*failed* to break it. Performance measures every budget on production-realistic
data and states pass or fail per budget.

The Test Lead then owns the judgement: a written summary with residual risk
stated plainly and an explicit recommendation — ship, ship with conditions, or do
not ship.

## operate → `runbook.md`

**Roles:** Observability, Support Lead, DevOps
**Gates:** `operate.monitoring`, `operate.support-readiness`, `operate.release`

The stage most frameworks omit, and the reason this one has six.

**`operate.monitoring`** — every designed alert exists, **has been deliberately
fired and observed to route**, and its runbook link resolves. Dashboards live.
Correlation id verified end to end. An alert nobody has seen fire is a belief,
not a control.

**`operate.support-readiness`** — a support agent on their first week can triage
a ticket from `runbook.md` alone: the questions customers will ask in *their*
words, how to tell user error from a defect, diagnostics the agent can run
themselves, an escalation path pointing at a rota rather than a person, and
known limitations mirrored back into `spec.md#known-issues`. Support briefed
*before* release, with the date recorded.

**`operate.release`** — DevOps is the last gate. Rollback **executed**, not
assumed. Deploy and rollback commands verbatim. Flags named with defaults. Smoke
check defined, and the signal that says roll back. Approving this on trust
rather than evidence makes the gate decorative.

---

## The other flows

**`bugfix`** — `frame` (Product, Support, QA: `spec.product`, `spec.reproduction`)
→ `slice` → `build` → `prove` (adds `prove.regression`) → `operate`
(`operate.support-readiness`, `operate.detection`).

`operate.detection` asks the question that stops a defect arriving twice: *would
monitoring have caught this?* If not, the fix is incomplete until the detection
gap is closed. A defect that reached a customer undetected is also a monitoring
defect.

**`spike`** — `frame` (`spec.product`, `spike.question`) → `prove`
(`spike.finding`). The question, its time box and the decision it unblocks are
written down before any code. The finding is written down even when it is "we
still don't know" — that is a real result, and recording it stops the next person
re-running the experiment. Run spikes at `standard` tier; `tiny` would drop
`spike.finding`, which is the whole point.

## Working ahead

Stage order is how gates are *evaluated*, not a ban on parallel work. Developers
prototype during `shape`; QA writes test cases during `slice`. What the ledger
prevents is **claiming completion** out of order — `fleet-sdd next` flags a gate
cleared ahead of an open stage, so a premature sign-off is visible rather than
silent.
