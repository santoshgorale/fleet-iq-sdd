# Prompts

The prompts behind this framework, kept in the repo so intent survives.

| File | Use it when |
| --- | --- |
| [00-original-brief.md](00-original-brief.md) | You want to know **what was actually asked for** before changing something — plus the chronological record of how the brief arrived, and the judgement calls nobody requested |
| [01-modify-framework.md](01-modify-framework.md) | You are **changing the framework itself** — a shipped role, a gate, a stage, a validator, a CLI command |

## Why these are here

The repo already explains itself three ways, and each answers a different
question:

| Document | Answers |
| --- | --- |
| [DESIGN.md](../DESIGN.md) | *Why* is it shaped like this? |
| [decisions.md](../decisions.md) | *What* was chosen, and what was rejected? |
| **These prompts** | *What was asked for* in the first place? |

The third is the one usually lost, and losing it is expensive. Code and design
notes tell you what exists; they cannot tell you which constraints were
requirements and which were a Tuesday afternoon's judgement. Without that, a
future change can satisfy every test and quietly betray the commission.

`00-original-brief.md` therefore ends with a short list of things the brief did
**not** ask for. A maintainer is entitled to overturn any of them — but should
know they are overturning a choice rather than a requirement.

## Using them

Both are written to be pasted into a fresh session. `00` will rebuild the
framework from an empty directory; `01` is a template with two bracketed sections
to fill in.

They are also just readable prose. If you are about to change something and only
have five minutes, read `00`'s appendix — the two design-changing amendments
there are the parts most likely to be undone by accident.

## Not for using the framework

These are for people working **on** Fleet SDD. If you are working **with** it:

- [quickstart.md](../quickstart.md) — a feature moving in ten minutes
- [authoring-roles.md](../authoring-roles.md) — add your own role, flow, tier,
  skill or tracker adapter. **This does not count as modifying the framework** —
  it is using it as designed, and needs no prompt from this folder.

## Adding your own

Drop a Markdown file in here. Numbered prefixes keep the reading order obvious.
Reasonable additions as the framework gets real use:

- a prompt for onboarding a team onto Fleet SDD
- a prompt for running a retrospective on the gate set itself — which gates keep
  getting waived, and what that says about them
- your team's house-style prompt for a specific artifact

Anything role-specific belongs in `.sdd/roles/` in your own install instead, where
`fleet-sdd next` will actually reach it.
