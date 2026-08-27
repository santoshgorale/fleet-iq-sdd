---
id: spike
name: Spike
description: >-
  A time-boxed investigation that answers one question. The output is a
  decision, not a feature.
stages:
  - id: frame
    name: State the question
    artifact: spec.md
    roles: [product-manager, architect]
    gates: [spec.product, spike.question]

  - id: prove
    name: Answer it
    artifact: evidence.md
    roles: [architect, tech-lead]
    gates: [spike.finding]
---

## The discipline a spike needs

Exactly two things, and both are gates so they cannot be skipped.

`spike.question` demands the question be written down **with its time box and
the decision it unblocks**, before any code is written. A spike without a
stated decision is a hobby.

`spike.finding` demands a written answer even when the answer is "we still
don't know" — that is a real finding, and recording it stops the next person
re-running the same experiment.

Spike code is throwaway by default. If it ships, it stops being a spike and
needs a `feature` flow of its own.

## Tier

Run spikes at `standard`. The flow is only three gates long, so there is nothing
for `tiny` to trim — and `tiny` would drop `spike.finding`, which is the entire
point of the exercise.

```bash
fleet-sdd new "Can we stream telemetry over MQTT?" --flow spike
```

