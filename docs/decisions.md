# Decision log

Append-only, newest first. One entry per decision that shapes how Fleet SDD
works.

**If you change the framework's shape, add an entry.** A change without one is
incomplete — the next person inherits the behaviour but not the reason, and then
either preserves a constraint that no longer applies or removes one that still
does.

Format: date, decision, why, what was rejected.

For *what was asked for* rather than what was decided, see
[prompts/00-original-brief.md](prompts/00-original-brief.md) — it separates the
requirements from the judgement calls, which this log does not.

---

## 2026-08-21 — The commissioning prompt is kept in the repo

**Decision.** [docs/prompts/](prompts/) holds the brief that produced the
framework, plus a template prompt for changing it. `AGENTS.md` points at the
brief first, ahead of DESIGN and this log.

**Why.** DESIGN.md says why the framework is shaped this way; this log says what
was chosen and rejected. Neither records *what was asked for* — and that is the
part that distinguishes a requirement from a Tuesday afternoon's judgement.
Without it, a future change can satisfy every test and still betray the
commission, or defend a constraint nobody ever wanted.

The brief therefore ends with an explicit list of things nobody asked for — six
stages rather than five, placeholder enforcement, generating the lifecycle
diagram, the framework documenting itself. A maintainer is entitled to overturn
any of them; they should know they are overturning a choice.

**Rejected.** Recording only the final consolidated prompt. The chronological
appendix is the more useful half: two of the seven exchanges changed the design
materially, and those are exactly the parts most likely to be undone by accident.

**Rejected also.** Storing it in `kit/`, which would push it into every product
repo. It is for people working *on* the framework, not with it.

## 2026-08-21 — Diagrams are generated SVG, not Mermaid

**Decision.** The README's four diagrams are SVG files in `docs/diagrams/`,
referenced with `<img>`. `lifecycle.svg` is generated from
`kit/.sdd/flows/feature.md` through the CLI's own YAML parser;
`npm run diagrams` rebuilds all four and `npm test` fails if a committed file is
stale. `docs/diagrams/index.html` shows them together without a server.

**Why.** The README shipped with Mermaid blocks and the diagrams were simply
invisible — Mermaid renders on github.com and almost nowhere else: not in VS Code
without an extension, not in most Markdown previews, not in a PDF export. A
diagram nobody can see is worse than no diagram, because the surrounding prose
assumes it was seen.

Generating the lifecycle one from the flow definition is the part worth keeping.
A hand-drawn version would have been accurate for about a week; this one grows a
row when a gate is added, and the staleness test makes that automatic rather than
remembered.

**Rejected.** Committing rendered PNGs — larger, blurry when zoomed, and they do
not diff. Rejected also: keeping Mermaid alongside the SVGs, which would mean two
sources of truth for the same picture and, inevitably, two that disagree.

**Accepted trade-off.** Each diagram paints an explicit white background so it
stays legible against a dark README theme. A proper dual-theme version would need
either two files per diagram or CSS inside the SVG that GitHub strips — not worth
it for a printed-card look that reads fine either way.

## 2026-08-21 — Adapters resolve by name, repo-local first

**Decision.** `fleet-sdd sync <provider>` dynamically imports
`.sdd/adapters/<provider>.mjs`, falling back to `cli/lib/adapters/<provider>.mjs`.
`sync --list` shows both. An adapter without a `syncTracker` export is rejected
with the contract's location.

**Why.** The original `cmdSync` hard-coded `provider !== 'jira'` and pointed at
the docs — which made "add your own tracker" a documentation claim rather than a
working feature. A team wanting Zephyr or Azure DevOps had to fork. Now they drop
a file in their own repo and it works, which is the same promise already made for
roles, flows and checklists. Consistency here matters more than the twenty lines
it cost.

**Rejected.** A `plugins:` list in `config.yml` — contrary to discovery over
registration. Rejected also: shipping a half-finished Zephyr adapter, which would
have implied support we cannot give for an API we have not tested against.

**Accepted trade-off.** A repo-local adapter is executed, so it is code the repo
owns — the same trust model as a build script or a git hook. Stated in the docs
rather than solved, because sandboxing a build-tool extension point would cost
far more than it protects.

## 2026-08-21 — The framework repo does not install its own `.sdd/`

**Decision.** `docs/specs/000-fleet-sdd-framework/` describes Fleet SDD in Fleet
SDD's own format, and `examples/specs/001-driver-scorecard/` is a worked product
feature — but neither is validated by a `.sdd/` install committed to this repo.
Instead, `test/run.mjs` installs the kit into a temporary directory, copies both
spec sets in, and runs `check` on every commit.

**Why.** Committing a live `.sdd/` here would duplicate 45 files that already
exist in `kit/`, and append a managed `AGENTS.md` block written for product repos
to a repo guide written for framework maintainers. The test gets the entire
benefit — both spec sets are continuously validated against a genuinely fresh
install — with none of the duplication. It also validates the *install path*
rather than a hand-placed copy, which is strictly stronger.

**Rejected.** A committed self-install, for the reasons above. Rejected also:
skipping the dogfood spec entirely — writing the framework in its own format
surfaced that `check` flags an artifact merely *discussing* the placeholder
marker, which is the validator being correctly strict and is now documented.

## 2026-08-21 — Tiers declare gates; artifacts are derived

**Decision.** A tier lists which *gates* are required. The required *artifacts*
are then computed: an artifact is required when the stage producing it has at
least one required gate. `extraArtifacts` covers files no stage produces, such
as `decisions.md` at tier `complex`.

**Why.** The first design had tiers list artifacts directly. That silently
coupled every tier to the `feature` flow — applying `tiny` to a `spike` demanded
a `tasks.md` the spike flow never produces, and dropped the `evidence.md` it
does. Deriving artifacts from gates makes tiers flow-agnostic, so a tier behaves
sensibly on a flow written after it.

**Rejected.** Per-flow tier overrides — more configuration to express something
the flow already knows.

## 2026-08-21 — Six stages: `operate` is part of shipping

**Decision.** The `feature` flow ends with an **operate** stage producing
`runbook.md`, gated by `operate.monitoring`, `operate.support-readiness` and
`operate.release`. `bugfix` carries `operate.detection` — *would monitoring have
caught this?*

**Why.** Requested during the initial build, and it closes the fourth of the
four failures in [DESIGN.md](DESIGN.md). Software nobody can observe or support
is not finished; it has been handed to someone else as a problem. Monitoring and
support were the two disciplines with no seat at the table, which is exactly why
they always arrive as surprises.

**Rejected.** Folding monitoring into `prove` — it would have been verified
against a test environment and never against the thing that pages people.
Rejected also: treating support enablement as a release checklist item, since
checklist items with no owner and no gate get skipped under deadline.

## 2026-08-21 — Two new roles, taking the count to thirteen

**Decision.** Added `observability-engineer` (monitoring and alerting) and
`support-lead` (product support). Observability holds `design.observability` in
the **shape** stage alongside Security and Performance.

**Why.** Alerts designed after an incident are a lesson learned; alerts designed
with the feature are a lesson avoided. Support is the cheapest available source
of truth about what actually goes wrong in production, and it was not being
asked. Adding both required no code change — which was also the first real proof
that "discovery over registration" holds.

**Rejected.** Giving DevOps the monitoring gate. It conflates *can we deploy it*
with *can we see it*, and in practice the second loses.

## 2026-08-21 — Every role owns at least one gate

**Decision.** Added `build.implementation`, owned by the Developer, so the
developer asserts their own work is finished before review begins.

**Why.** `check` warns when a role owns no gates, because `next` can never route
work to it — the role is decoration. The Developer was the one role in that
position. A self-assertion gate also makes code review cheaper: the reviewer
starts from work someone has already declared complete.

**Rejected.** Suppressing the warning.

## 2026-08-21 — Roles are lenses on shared artifacts, not owners of documents

**Decision.** Five artifacts per feature (`spec.md`, `design.md`, `tasks.md`,
`evidence.md`, `runbook.md`), with roles owning *sections*. Not a PRD plus a UX
spec plus an architecture document plus a test plan.

**Why.** Documents with separate owners drift apart, and drift is the failure
this framework exists to prevent. Sections of one file are reviewed in one diff.
The cost — roles must respect each other's sections — is a discipline worth
paying for, and every adapter states it explicitly.

**Rejected.** BMAD's document-per-role model. More faithful to how teams
currently work, and it reproduces the problem.

## 2026-08-21 — `TODO(sdd)` placeholders are enforced

**Decision.** Templates ship full of `TODO(sdd)` markers. `check` fails if one
survives in an artifact whose stage has been signed off.

**Why.** Without teeth, a spec-driven process becomes a folder of half-written
documents that everyone has learned to skip. This makes an empty section
impossible to approve silently — the file reports it. Agents are told never to
delete a marker to make `check` pass; the correct response is real content or
resetting the gate.

**Rejected.** Requiring a minimum word count per section. Trivially gamed, and
it punishes brevity.

## 2026-08-21 — Discovery over registration

**Decision.** Roles, flows and checklists are found by scanning `.sdd/`. No
manifest, no index, no code change.

**Why.** The framework has to be extensible by the team, not by whoever
maintains it. A central registry turns "add a role" into a negotiation with the
file's owner, and that is how a platform becomes a product.

**Rejected.** A `roles:` list in `config.yml`. Marginally faster to load,
directly contrary to the goal.

## 2026-08-21 — Zero runtime dependencies, including the YAML parser

**Decision.** Node built-ins only. `cli/lib/yaml.mjs` is a hand-written YAML
subset — block maps and sequences, flow collections, block scalars, comments.

**Why.** A tool that needs `npm install` to read a Markdown file cannot credibly
claim to be lightweight, and it will not survive contact with a locked-down
build environment. The parser is roughly 300 lines and covers exactly what
`.sdd/` uses; it throws a readable error rather than guessing on anything else.

**Rejected.** `js-yaml`. Better in every respect except the one that mattered.

## 2026-08-21 — Overrides plus a hash manifest, instead of "don't edit these files"

**Decision.** `.sdd/overrides/<path>` shadows `.sdd/<path>` and is never touched
by an upgrade. Files edited in place are detected by hash, left alone, and get
the incoming version as `<name>.new`. `AGENTS.md`, `CLAUDE.md` and `.gitignore`
are merged by marked block.

**Why.** Teams will edit the kit — that is the intent. Any upgrade mechanism
that can lose that work will stop being run, and the framework will fossilise at
whatever version was first installed. Hashes are computed on LF-normalised
content so a CRLF checkout on Windows does not read as a local edit.

**Rejected.** Overwriting on upgrade with a warning. Rejected also: refusing to
upgrade any modified file, which strands teams on old versions of files they
barely changed.

## 2026-08-21 — Agents do the work; humans sign the gates

**Decision.** Every adapter instructs agents never to run `fleet-sdd gate
... approve`. Agents fill artifacts, review against checklists, and offer the
command.

**Why.** A gate is a person accepting accountability for a judgement. An agent
approving its own work leaves the ceremony and removes the substance, which is
worse than having no gate at all — it manufactures a signed-off audit trail
behind unreviewed work.

**Rejected.** Letting agents approve low-risk gates. Every category boundary we
could describe was one an agent would have to judge, which is the same problem.

## 2026-08-21 — Jira sync is opt-in and dry-run by default

**Decision.** `fleet-sdd sync` prints payloads and exits. Creating issues needs
`--apply`. Credentials come from the environment only.

**Why.** Pushing to a tracker is outward-facing and hard to undo — a stray run
that creates forty issues costs someone an afternoon of deletions. Dry-run also
makes the adapter useful before anyone has configured credentials.

**Rejected.** Reading credentials from `.sdd/config.yml`. Convenient, and it
puts tokens in git.

## 2026-08-21 — No CI enforcement in v1

**Decision.** `check` exits 1 and is trivially wired into a pipeline. Nothing is
wired by default.

**Why.** Turning a brand-new process into a merge blocker is how frameworks get
resented instead of adopted. Let the team choose the moment.

**Rejected.** Shipping a GitHub Action. Worth revisiting once the gate set has
settled from real use.
