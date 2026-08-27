# Examples

## `specs/001-driver-scorecard/`

A complete feature at tier `standard`, taken all the way through the `feature`
flow. Every artifact filled, all seventeen gates signed off with real notes.

This is the answer to the question every team asks first: *what does a good one
actually look like?*

Read it in this order:

| File | Worth noticing |
| --- | --- |
| `spec.md` | The problem statement carries counts, not adjectives — "23 of our 41 enterprise accounts" is why this got built. The out-of-scope list is longer than the in-scope one. |
| `design.md` | Two rejected alternatives with measured reasons. Security, Performance and Observability each own a section, written at design time. The failure-mode table states a principle: stale is acceptable, wrong is not. |
| `tasks.md` | The traceability table runs both ways, and the reverse check explains why three tasks map to no criterion. Test data was a deliberate decision, not an afterthought. |
| `evidence.md` | Records what was *not* covered and what failed. Two alerts were misrouted when first created — found by testing them, not by an incident. |
| `runbook.md` | Written for a support agent on their first week. Four diagnostics they can run alone, and an S1 path for cross-fleet visibility. |
| `gates.yml` | Every note says something. Compare `design.observability` — the reason an SLI was added — with a note that just said "looks good". |

The parts worth copying are the unglamorous ones: the reverse traceability check,
the "deliberately not covered" line, and the "signals that are normal" section of
the runbook. Each exists because its absence causes a specific, recurring
failure.

## Why it lives here and not in `docs/specs/`

This repo is the framework, not a product using it. Keeping a fictional product
feature out of `docs/specs/` avoids implying the framework tracks its own work
next to a fleet-telematics feature.

It is still validated on every commit: `test/run.mjs` installs the kit into a
temporary directory, copies both this example and
[`docs/specs/000-fleet-sdd-framework/`](../docs/specs/000-fleet-sdd-framework)
into it, and runs `check`. If a schema change breaks either, the build fails —
and the fix is the example, never the validator. The example *is* the
documentation.

## The framework's own spec

[`docs/specs/000-fleet-sdd-framework/`](../docs/specs/000-fleet-sdd-framework)
describes Fleet SDD using Fleet SDD — its threat model, its performance budgets,
its own runbook.

It is the second-best example here, and the more useful test: if the framework
could not express its own construction, it would be too rigid to trust with
anyone else's.
