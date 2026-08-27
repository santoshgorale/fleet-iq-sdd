# The original brief

The prompt that produced Fleet SDD, consolidated into a single reusable form.

Paste it into a fresh session to rebuild the framework from nothing, or read it
to understand what was actually asked for before you change something. The
chronological record of how the brief arrived — including two mid-build
amendments — is in the appendix.

> **Why this file exists.** [DESIGN.md](../DESIGN.md) says *why* the framework is
> shaped this way and [decisions.md](../decisions.md) records *what* was chosen
> and rejected. Neither captures *what was asked for*. Without that, a future
> change can satisfy the code and quietly betray the commission.

---

## The consolidated prompt

````markdown
You are an expert Platform Architect and AI engineer.

## Goal

Build a simple spec-driven development (SDD) framework that lets a delivery team
collaborate easily across these roles:

Product Management · UX · Product Owner/Project Manager · Architect ·
Technical Lead · Developers · Test Lead · QA Engineer · DevOps Engineer ·
Security Engineering · Performance Engineering · Monitoring and Alerting ·
Product Support

Keep it **simple and scalable**, so teams can bring their own prompts and skills
and embed them inside the framework. **Usage must be very simple.**

## Study these, take what works, leave what does not

| Repository | Take |
| --- | --- |
| https://github.com/agentsmd/agents.md | The portable entry point — one predictable file every coding agent already reads |
| https://github.com/github/spec-kit | The artifact pipeline, and the layered template-resolution stack |
| https://github.com/bmad-code-org/bmad-method | Role personas as first-class files, and per-role checklists |
| https://github.com/open-gsd/gsd-core | Verification before "done" |

Record in the repo what you took from each and what you deliberately refused.
None of the four is small enough that thirteen people will adopt it — that gap is
the thing to close.

## Decisions already made — do not re-litigate these

- **AI tooling:** Claude Code is primary. `AGENTS.md` is the portable fallback
  for Cursor, Copilot and Codex. Artifacts must stay readable by people with no
  AI tooling at all.
- **Distribution:** this repo *is* the kit. A Node CLI (`npx <name> init`)
  installs it into product repos and re-syncs safely on upgrade.
- **Artifacts:** a lean core. Roles are **lenses on shared files**, not owners of
  private documents. No separate PRD + UX spec + architecture doc + test plan.
- **Integrations:** files-only core. Jira task-sync ships as an opt-in,
  dry-run-by-default adapter. No CI gate enforcement in v1.
- **Installer runtime:** Node, invoked with `npx`.

## Hard constraints

1. **Zero runtime dependencies.** Node built-ins only — including the YAML
   parsing. A tool that needs `npm install` to read a Markdown file has already
   lost the argument about being lightweight.
2. **Discovery over registration.** Adding a role, flow or checklist must never
   mean editing an index. Dropping a file in a folder is the whole install step.
3. **The CLI never owns semantics.** Every prompt, checklist and rule lives in
   Markdown. The CLI only globs, validates and reports — so a team can change how
   the framework behaves without waiting for anyone.
4. **Idempotent install.** Running it twice must never destroy work.
5. **Cross-platform.** Windows dev boxes, POSIX CI.
6. **Exactly three concepts.** If a team must learn a fourth, the design failed.
7. **One command anyone has to remember.** Onboarding should be a single
   sentence.

## Design requirements

- **Specialists design; they do not inspect.** Security, Performance and
  Observability hold gates at *design* time, beside architecture — not at
  release. A threat model, a latency budget and an alert design are cheap on a
  whiteboard and expensive afterwards.
- **Operability is part of shipping.** There must be a stage that gates
  monitoring and support readiness *before* release. Require that every alert has
  been deliberately fired and observed to route, and that support was briefed
  before release rather than after.
- **Give it teeth.** A process that only asks people to be diligent gets as much
  diligence as the week allows. There must be a mechanism that makes signing off
  on unfinished work fail, mechanically.
- **Agents do the work; humans sign the gates.** A gate is a person accepting
  accountability. Agents must never approve their own work.

## Deliverables

1. The kit: roles, flows, checklists, artifact templates, a constitution, and an
   extension guide — all Markdown, all copied into product repos.
2. The CLI: install/upgrade, scaffold, "what's next", record a sign-off,
   validate, status, doctor, tracker sync.
3. Adapters for Claude Code, Cursor and Copilot, generated from the one kit and
   thin enough that they restate nothing.
4. A test suite with no mocks — real installs into temporary directories.
5. Documentation, including the design rationale and a decision log **kept in the
   repo**, so the team can understand how this was built without asking.
6. A worked example: one complete feature with every artifact filled and every
   gate signed. This is what teams ask for first.
7. Diagrams that render **everywhere**, not only on github.com.

## Definition of done

- The shipped kit validates itself on a fresh install.
- The framework can express its own construction in its own format.
- A new role can be added with no code change, and a test proves it.
- An upgrade cannot destroy a locally edited file, and a test proves it.
- Every internal documentation link resolves.
````

---

## Appendix: how the brief actually arrived

The consolidated prompt above is tidier than reality. It was assembled from seven
exchanges, and two of them changed the design materially. Both are worth knowing
about, because they are the parts a future reader is most likely to undo by
accident.

### 1 — The opening request

The role list, the four reference repositories, "keep it simple and scalable thus
teams can come with their own prompts/skills and embed inside the framework", and
"usage should be very simple". Eleven roles at this point.

### 2 — Clarifying answers

Six choices, captured in the *Decisions already made* section above: Claude Code
plus portable agents; portable kit and installer; lean core with role lenses;
files-only with an opt-in tracker; Node CLI via `npx`; Jira first.

### 3 — "Keep the plan in the repo"

> *Ensure the plan is kept updated somewhere in the repo for team to understand
> how this is built.*

This produced [DESIGN.md](../DESIGN.md) and [decisions.md](../decisions.md), and
the rule that **a change to the framework's shape is incomplete without a
decision-log entry**. It is also why this file exists.

### 4 — Monitoring, alerting and support *(design-changing)*

> *We need to update this framework further for monitoring and alerting, product
> support roles.*

This took the framework from eleven roles to thirteen and from five stages to
six. It added the `observability-engineer` and `support-lead` roles, the
`operate` stage, `runbook.md`, and the gates `operate.monitoring`,
`operate.support-readiness` and `operate.detection`.

**It required no code change**, which was the first real evidence that
"discovery over registration" was working rather than merely stated.

### 5 — A role-first README with visualisations

> *Update the Readme further making it easier for any role to understand this
> framework and use it effectively by combination of framework and creating any
> skills missing or they can get their own skills from elsewhere. Ensure to
> provide a visualisation in Readme of how the framework helps in collaboration
> with SDLC/STLC flows, third party tools like Jira, Zephyr, or any other and how
> it can be extended further easily. Provide links to all documents.*

This produced the start-here-by-role table, the skills section, the four
diagrams, and the full document index.

It also exposed a lie: `sync` had `provider !== 'jira'` hard-coded while the docs
claimed you could add your own tracker. Adapters now resolve by name with
`.sdd/adapters/` taking precedence, so Zephyr or Azure DevOps is one file in your
own repo. **If a README claim is not executable, fix the code, not the README.**

### 6 — The diagrams were invisible *(design-changing)*

> *The flow chart is not visible on the readme — how can it show visualisation?
> Can you create one and keep it in one of the folders?*

The README had shipped with Mermaid, which renders on github.com and almost
nowhere else. Replaced with generated SVG in [docs/diagrams/](../diagrams/), with
`lifecycle.svg` built from the flow definition so it cannot drift, and a
staleness test so it cannot rot.

### 7 — This file

> *Provide prompt for this whole session and store it for reference thus if
> anyone wants to modify the framework they can refer the same.*

See also [01-modify-framework.md](01-modify-framework.md) for the prompt to use
when changing any of this.

---

## What the brief did *not* ask for

Worth recording, because these were judgement calls rather than instructions, and
a future maintainer is entitled to overturn them:

- Six stages rather than five — a reading of "monitoring and support roles" that
  gave them a stage, not just a checklist item.
- `TODO(sdd)` placeholder enforcement — nobody asked for teeth; the brief asked
  for a framework teams would use, and a process with no teeth becomes a folder
  of half-written documents.
- Generating the lifecycle diagram from the flow file rather than drawing it.
- The framework documenting itself in its own format
  ([docs/specs/000-fleet-sdd-framework/](../specs/000-fleet-sdd-framework/)).

Each is argued in [decisions.md](../decisions.md).
