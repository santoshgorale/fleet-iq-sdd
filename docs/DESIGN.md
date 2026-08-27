# Fleet SDD — design

Why this framework exists, what it borrowed, what it deliberately refused, and
the rules that govern changes to it. If you are about to change how Fleet SDD
works, read this first and add an entry to [decisions.md](decisions.md) after.

---

## The problem

A delivery team spanning thirteen roles — Product, UX, Product Owner/Project
Manager, Architect, Tech Lead, Developers, Test Lead, QA, DevOps, Security,
Performance, Observability and Support — does not fail at any one of those jobs.
It fails **between** them.

Four failures, specifically, and each one is what a piece of this framework
exists to prevent:

1. **Requirements drift from design, and design drifts from tests.** Three
   documents, three owners, no mechanism forcing them to agree. Within a
   quarter, nobody trusts any of them, and a team that has learned to ignore its
   documents cannot be given new ones.
2. **Security, performance, observability and support arrive too late to
   matter.** They are treated as reviews of finished work rather than inputs to
   it. By the time they are consulted, every cheap option is gone.
3. **Nobody can answer "what is blocked and who owns it?"** without a meeting.
   The information exists, distributed across people's heads, which is the one
   place it cannot be queried.
4. **Software gets handed over unobservable and unsupportable.** It works on
   someone's machine, ships, and becomes an on-call problem and a queue of
   tickets that nobody anticipated.

## What already existed, and why none of it was enough

| Source | What we took | Why it wasn't sufficient alone |
| --- | --- | --- |
| [github/spec-kit](https://github.com/github/spec-kit) | The artifact pipeline, and the layered template-resolution stack that became `.sdd/overrides/` | Optimised for a single developer with an agent. No concept of multiple roles holding each other to account. |
| [bmad-method](https://github.com/bmad-code-org/bmad-method) | Role personas as first-class files, and per-role checklists | Enough ceremony that teams bounce off it. Roles own separate documents, which reintroduces exactly the drift we are trying to kill. |
| [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) | Verification before "done" — the insistence that a feature is not finished until someone has demonstrated it working | Solves context management for an agent, not coordination between people. |
| [agents.md](https://agents.md) | The portable entry point: one predictable file every coding agent already reads | A convention for context, not a process. |

The gap all four leave: **none of them is small enough that thirteen people
will actually adopt it**, and none treats operability as part of shipping.

## The design

### Three concepts, and nothing else

If a team has to learn a fourth concept, the framework has failed.

**1. Artifacts** are the shared truth. Five Markdown files and a ledger, per
feature, in git, reviewable in a pull request:

```
docs/specs/001-driver-scorecard/
├─ spec.md        WHAT & WHY      Product, UX
├─ design.md      HOW             Architect, Tech Lead, Security, Performance, Observability
├─ tasks.md       SLICES          Product Owner, Tech Lead, Test Lead
├─ evidence.md    PROOF           Developer, QA, Test Lead, DevOps, Security, Performance
├─ runbook.md     OPERABLE        Observability, DevOps, Support
└─ gates.yml      SIGN-OFF        everyone
```

**Five files, not thirteen.** This is the single most important decision in the
framework. Roles are *lenses on shared files*, not owners of private documents.
A PRD, a separate UX spec, a standalone architecture doc and an independent test
plan cannot drift apart if they are sections of the same file that get reviewed
in the same diff. The cost is that roles must respect each other's sections; the
benefit is that drift becomes visible instead of invisible.

**2. Roles** are lenses, one Markdown file each, in `.sdd/roles/`. Front matter
declares the sections the role `owns` and the `gates` it may sign. The body is
mission, ordered steps, definition of done, and — most usefully — **what this
role must never sign off on**.

Discovery is by directory scan. Dropping a file in is the entire installation
procedure. There is no registry to edit and no code to change, which is what
makes the framework a platform rather than a product.

**3. Flows** are ordered stages, one file each in `.sdd/flows/`. A stage names
its artifact, its roles, and the gates that must clear before the next stage
opens. Three ship: `feature`, `bugfix`, `spike`.

### The ledger is the coordination mechanism

`gates.yml` is the answer to failure #3, and it is deliberately boring:

```yaml
gates:
  spec.product:        { status: approved,          by: sam@example.com, at: 2026-08-21 }
  design.architecture: { status: pending }
  design.security:     { status: changes-requested, by: dev@example.com, note: "PII in telemetry payload" }
```

One file answers what is blocked, who owns it, and why. It diffs cleanly, it
lives beside the code it governs, and it needs no server. `fleet-sdd next` reads
it and tells one person what to do — which is the only interface most of the
team ever needs.

Statuses are `pending`, `in-review`, `approved`, `changes-requested`, `waived`.
A waiver requires a written reason and stays in the ledger permanently. That is
the difference between a decision the team can defend and a corner quietly cut.

### Specialists design; they do not inspect

Security, Performance and Observability hold gates in the **shape** stage,
beside architecture — not at release. This is the fix for failure #2 and the
largest departure from how most teams sequence this work.

A threat model, a latency budget and an alert design cost an hour on a
whiteboard. The same three things cost a quarter after release, and by then the
answers are constrained by decisions nobody remembers making.

### Operability is a stage, not a hope

The `feature` flow has six stages, not five. The sixth, **operate**, produces
`runbook.md` and carries three gates: `operate.monitoring`,
`operate.support-readiness`, `operate.release`.

This is the fix for failure #4. Software that nobody can observe or support is
not finished — it has merely been handed to someone else as a problem. Two
gates make that concrete:

- **`operate.monitoring`** requires that every alert *has been deliberately
  fired and observed to route*. An alert nobody has seen fire is a belief, not
  a control.
- **`operate.support-readiness`** requires that the people answering customer
  questions were briefed *before* release, and that a support agent can triage
  a ticket from the runbook alone.

`bugfix` carries a narrower version, `operate.detection`, which asks the one
question that stops a defect arriving twice: *would monitoring have caught
this?* If not, the fix is incomplete.

### Where the teeth are

A process that only asks people to be diligent gets exactly as much diligence as
the week allows. Two mechanisms make Fleet SDD enforceable rather than
aspirational:

**`TODO(sdd)` placeholders.** Templates are full of them. `fleet-sdd check`
fails if a placeholder survives in an artifact whose stage has been signed off.
You cannot approve an empty threat model — the file itself reports the lie.

**Gate validation.** `check` fails on a waiver with no reason, an approval with
no owner, a gate no role can sign, a gate the flow does not declare, and a
required gate missing from the ledger. Exit code 1, in a pipeline if you want it.

### Portability

`AGENTS.md` at the repo root is the tool-agnostic entry point, read by Cursor,
Copilot, Codex, Gemini CLI and others. `.claude/commands/sdd/*.md` gives Claude
Code six slash commands. `.cursor/rules/` and `.github/copilot-instructions.md`
are generated from the same kit.

Every adapter is *thin*: it reads `.sdd/` rather than restating it. That is the
whole trick — improving a role file improves every tool at once, and no adapter
can drift from the framework because none of them contains a copy of it.

---

## The five rules

Violating these turns Fleet SDD back into the thing it was built to replace.

**1. Zero runtime dependencies.** Node built-ins only, including a hand-written
[YAML subset parser](../cli/lib/yaml.mjs). A framework that needs `npm install`
to read a Markdown file has already lost the argument about being lightweight.

**2. Discovery over registration.** Never require editing an index to add a
role, flow or checklist. The moment a central list exists, adding capability
becomes a negotiation.

**3. The CLI never owns semantics.** Every prompt, checklist and rule lives in
`.sdd/*.md`. [`cli/`](../cli) only globs, validates and reports. A team must be
able to change how the framework behaves without waiting for anyone — this is
what "scalable" means here, and it is worth more than any feature.

**4. Idempotent `init`.** Running it twice must never destroy work. Enforced by
a hash manifest plus marked blocks; covered by tests.

**5. Cross-platform paths.** Windows dev boxes, POSIX CI. `node:path`
throughout, LF line endings via `.gitattributes`, and hashes computed on
normalised content so a CRLF checkout does not read as a local edit.

## What was deliberately left out

- **CI gate enforcement.** `check` returns exit 1 and is trivially wired into a
  pipeline, but nothing is wired by default. Turning a new process into a merge
  blocker on day one is how frameworks get resented.
- **A web UI or server.** Git is the database, `gates.yml` is the record, a pull
  request is the review. Adding a service would add an operational burden to a
  tool whose only job is reducing burden.
- **Per-role artifacts.** Considered and rejected — see the five-files decision
  above. It is closer to BMAD and it reintroduces the drift.
- **Automated gate approval by agents.** Every adapter tells agents explicitly
  not to run `fleet-sdd gate approve`. A gate is a person accepting
  accountability; automating it leaves the ceremony and removes the substance.

## Reading the code

| Path | Does |
| --- | --- |
| [`cli/lib/yaml.mjs`](../cli/lib/yaml.mjs) | YAML subset parser and emitter. The only clever file; everything else is plumbing. |
| [`cli/lib/discover.mjs`](../cli/lib/discover.mjs) | Turns `.sdd/` into an index. Override resolution and feature lookup live here. |
| [`cli/lib/gates.mjs`](../cli/lib/gates.mjs) | Reads and writes the ledger. `computeNext` is the "what's next" logic. |
| [`cli/lib/check.mjs`](../cli/lib/check.mjs) | Every validator. Where the teeth are. |
| [`cli/lib/install.mjs`](../cli/lib/install.mjs) | Manifest-based upgrade and marked-block merging. |
| [`cli/lib/adapters/resolve.mjs`](../cli/lib/adapters/resolve.mjs) | Adapter lookup. `.sdd/adapters/` beats shipped, so a team adds a tracker without forking. |
| [`cli/sdd.mjs`](../cli/sdd.mjs) | Argument parsing, commands, output formatting. |
| [`kit/`](../kit) | Everything copied into a product repo. All content, no logic. |
| [`test/run.mjs`](../test/run.mjs) | 43 tests, no mocks — real installs into temp directories. |
