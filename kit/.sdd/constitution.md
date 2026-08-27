# Engineering constitution — {{PROJECT}}

> **Edit this file first.** It ships with defaults that are deliberately
> uncontroversial; they are a starting point, not your team's beliefs.
>
> Every role reads this before touching an artifact. A principle here outranks
> convenience, a deadline, and any individual's preference. If a feature needs
> to violate one, that is a conversation and a written exception — not a quiet
> workaround.

## How to read this

Each principle is stated as something we **will** or **will not** do, so it can
actually be applied to a decision. "We value quality" is not a principle; it is
a mood. Keep this file short — a constitution nobody remembers governs nothing.

Suggested ceiling: ten principles.

---

## P1 — Specs precede code

No production code without an approved `spec.md`, and for anything beyond tier
`tiny`, an approved `design.md`. Prototypes and spikes are exempt, and spike
code does not ship.

## P2 — The artifacts are the truth

When code and `design.md` disagree, one of them is wrong and both get fixed in
the same change. Documents that drift become worthless within a quarter, and a
team that has learned to ignore its documents cannot be given new ones.

## P3 — Security, performance and observability are design inputs

They hold gates at design time, not release time. A threat model, a latency
budget and an alert design are cheap on a whiteboard and expensive in
production. Nobody may defer them to "after launch".

## P4 — Nothing ships that cannot be observed

Every user-visible behaviour has a signal that tells us it is working. If it
breaks and monitoring stays green, that is a defect in its own right and gets
fixed.

## P5 — Nothing ships that cannot be supported

Before release, the people who answer customer questions know what changed, what
customers will ask, and what to do about it. Support is not a downstream
consequence of shipping; it is part of shipping.

## P6 — Nothing ships that cannot be reversed

Rollback is designed with the feature and tested before release. Where reversal
is genuinely impossible — some migrations — that is stated in writing and
accepted deliberately, not discovered.

## P7 — Evidence over assertion

A gate is signed on what someone observed, not on what was promised or on a
green pipeline. "The tests pass" is evidence that the tests pass.

## P8 — Waivers are recorded, never implied

Any gate may be waived when the team decides the cost is not worth it. It must
carry a written reason, and it stays in the ledger. A waiver is a decision we
can defend; a skipped gate is one we cannot.

## P9 — Personal data is minimised everywhere, including telemetry

We collect what we need and no more, and that rule applies to logs, metric
labels and analytics — where it is most often broken by accident.

## P10 — The framework serves the team

If a gate consistently produces no value, delete it. If a role is missing, add
one. `.sdd/` is yours to change; see `.sdd/EXTENDING.md`. Ceremony that survives
only because it is written down is exactly what this framework exists to avoid.

---

## Exceptions

| Date | Feature | Principle | Why | Approved by |
| --- | --- | --- | --- | --- |
| | | | | |
