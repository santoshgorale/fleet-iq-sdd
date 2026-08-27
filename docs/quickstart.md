# Quickstart

Ten minutes from nothing to a feature moving through gates.

## 1. Install into your product repo

```bash
cd your-product-repo
npx fleet-sdd init
```

Add adapters for other tools if your team uses them:

```bash
npx fleet-sdd init --adapters=claude,cursor,copilot
```

What appears:

| Path | What it is |
| --- | --- |
| `.sdd/` | Roles, flows, checklists, templates, constitution. Yours to edit. |
| `AGENTS.md` | Portable entry point every coding agent reads. Merged by marked block — your existing content is preserved. |
| `CLAUDE.md` | Points at `AGENTS.md`, plus the slash-command reference. |
| `.claude/commands/sdd/` | Six slash commands. |
| `.claude/skills/sdd-review/` | Artifact review skill. |

Re-running `init` upgrades safely. Files you edited are left alone — see
[upgrading](upgrading.md).

## 2. Write your constitution

```bash
$EDITOR .sdd/constitution.md
```

**Do this before your first feature.** It ships with ten deliberately
uncontroversial principles as a starting point — they are not yet your team's
beliefs, and every role reads this file before touching an artifact.

Keep it under ten principles. Each one stated as something you **will** or
**will not** do, so it can be applied to a decision. "We value quality" is not a
principle; it is a mood.

## 3. Create a feature

```bash
npx fleet-sdd new "Driver scorecard"
```

Choose the flow and tier deliberately:

| Flow | For |
| --- | --- |
| `feature` *(default)* | New capability. Six stages. |
| `bugfix` | A defect with a reproduction. Skips solution shaping. |
| `spike` | A time-boxed question. Output is a decision. |

| Tier | For |
| --- | --- |
| `tiny` | Copy change, config, small fix. Fewer gates. |
| `standard` *(default)* | A normal feature. |
| `complex` | Cross-team or high-risk. Adds a decision record. |

```bash
npx fleet-sdd new "Fix stale odometer reading" --flow bugfix --tier tiny
```

## 4. Ask what is next

```bash
npx fleet-sdd next
```

This is the command to teach the team. It reads the ledger and prints the active
stage, the artifact, every blocking gate, the role that owns it, and its
checklist path.

Onboarding is one sentence: **run `fleet-sdd next` and do what it says.**

## 5. Do the work

Open the role file for the blocking gate, work its steps, and fill your sections
of the artifact.

```bash
npx fleet-sdd roles product-manager    # prints the role in full
```

With Claude Code, skip the reading:

```
/sdd:next
```

That loads the constitution, the role, its checklist and the artifact, does the
work, and reports what still needs a human. It will not approve the gate — that
part is yours.

**Stay in your own sections.** Thirteen roles share five files. It works because
each role writes only the sections it owns.

**Leave `TODO(sdd)` where you do not know.** An honest gap is useful. Invented
content that reads as settled is not, and `check` will fail if a marker survives
sign-off.

## 6. Sign the gate

```bash
npx fleet-sdd gate spec.product approve -m "criteria reviewed with Ops"
```

Other verdicts:

```bash
npx fleet-sdd gate spec.ux request-changes -m "no offline state specified"
npx fleet-sdd gate design.performance waive -m "internal tool, 12 users"
npx fleet-sdd gate design.security review          # marks it in progress
npx fleet-sdd gate spec.product reset              # artifact changed after sign-off
```

Waivers need a reason and stay in the ledger permanently. That is the difference
between a decision you can defend and a corner quietly cut.

Approving prints the next blocking gate automatically.

## 7. Check before you claim to be done

```bash
npx fleet-sdd check
```

Exit 1 means errors. It catches signed-off artifacts with placeholders left in,
waivers with no reason, approvals with no owner, gates no role can sign, and
required gates missing from a ledger.

## 8. See the whole board

```bash
npx fleet-sdd status
```

```
  FEATURE                           STAGE     GATES   BLOCKED ON
  001-driver-scorecard              shape     3/18    design.security, design.observability
* 002-fuel-anomaly-alerts           operate   15/18   operate.support-readiness
```

Read the pattern, not just the rows. Several features blocked on the same gate
usually means one role is a bottleneck — or that gate is badly specified.

---

## The whole cycle

```bash
npx fleet-sdd new "Driver scorecard"
npx fleet-sdd next                                    # frame: spec.product
# ... write spec.md as Product, then UX ...
npx fleet-sdd gate spec.product approve -m "reviewed"
npx fleet-sdd gate spec.ux approve -m "states covered"
npx fleet-sdd next                                    # shape: design.md, five gates
# ... Architect, Security, Performance, Observability ...
npx fleet-sdd check                                   # before you believe it
```

## Next

- [Lifecycle](lifecycle.md) — what each of the six stages produces
- [Roles](roles.md) — all thirteen and their gates
- [Authoring](authoring-roles.md) — add your own role in about five minutes
