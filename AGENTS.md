# Fleet SDD — repo guide

This repo **is** the framework. It is not a product using Fleet SDD; it is the
kit that gets installed into product repos.

## Read these before changing anything

1. **[docs/prompts/00-original-brief.md](docs/prompts/00-original-brief.md)** —
   what was actually commissioned, how the brief arrived, and the four judgement
   calls nobody asked for. Read this first: it is the only file that distinguishes
   a requirement from a Tuesday afternoon's decision.
2. **[docs/DESIGN.md](docs/DESIGN.md)** — the problem this solves, the three
   concepts, what was taken from spec-kit / BMAD / GSD / AGENTS.md, what was
   deliberately refused, and the five rules that govern the code.
3. **[docs/decisions.md](docs/decisions.md)** — every shaping decision with its
   reasoning and the alternatives rejected.

These exist so nobody has to reverse-engineer intent from the code. Skipping them
typically means reintroducing something that was rejected on purpose.

**Making a change?** [docs/prompts/01-modify-framework.md](docs/prompts/01-modify-framework.md)
is the working checklist — invariants, what to run, and which docs go stale most
often.

## Layout

| Path | What it is |
| --- | --- |
| `cli/sdd.mjs` | Argument parsing, commands, output. |
| `cli/lib/yaml.mjs` | YAML subset parser and emitter. The only clever file. |
| `cli/lib/discover.mjs` | `.sdd/` → in-memory index. Overrides, feature lookup. |
| `cli/lib/gates.mjs` | Ledger read/write; `computeNext` is the "what's next" logic. |
| `cli/lib/check.mjs` | Every validator. Where the teeth are. |
| `cli/lib/install.mjs` | Manifest upgrade, marked-block merging. |
| `cli/lib/adapters/resolve.mjs` | Adapter lookup — `.sdd/adapters/` beats shipped. |
| `cli/lib/adapters/jira.mjs` | The reference tracker adapter. |
| `kit/` | **Everything copied into a product repo.** All content, no logic. |
| `docs/` | DESIGN, decisions, and the five guides. |
| `docs/diagrams/build.mjs` | Generates the four README SVGs. `lifecycle.svg` is built from the flow file, so it cannot drift. |
| `examples/` | A worked feature that must pass `check`. |
| `docs/specs/000-fleet-sdd-framework/` | The framework's own spec, in its own format. |
| `test/run.mjs` | 43 tests, no mocks. |

## Commands

```bash
npm test                                    # the whole suite
node cli/sdd.mjs <command>                  # run the CLI from source
node cli/sdd.mjs init --into /tmp/scratch   # install into a throwaway repo
node cli/sdd.mjs doctor                     # inspect an install
```

There is no build step and there are no dependencies. `npm install` does nothing
useful here, which is intentional.

## The five rules

Breaking any of these turns Fleet SDD back into the thing it replaced.
[DESIGN.md](docs/DESIGN.md) explains each; the short form:

1. **Zero runtime dependencies.** Node built-ins only. Never add a package.
2. **Discovery over registration.** Never require editing an index to add a
   role, flow or checklist.
3. **The CLI never owns semantics.** Prompts, checklists and rules live in
   `kit/.sdd/*.md`. `cli/` only globs, validates and reports. If you want to add
   logic to express something about process, it belongs in a role or flow file.
4. **Idempotent `init`.** Running it twice must never destroy work.
5. **Cross-platform paths.** `node:path` throughout, LF endings, hashes on
   normalised content.

## Conventions

- ES modules, `.mjs`, `node:`-prefixed built-in imports.
- Comments explain *why*, not *what*. Several exist specifically to stop a
  future reader "simplifying" a deliberate choice — leave those.
- CLI output: lowercase status words, two-space indent, colours via the local
  `paint` helpers, and **pad before colouring** — ANSI codes count toward string
  length.
- Errors a user could hit are `SddError`, which prints without a stack trace.
  Anything else is a bug and should throw loudly.

## When you change the framework's shape

Add an entry to [docs/decisions.md](docs/decisions.md): date, decision, why,
what was rejected. Newest first. A change without one is incomplete — the next
person inherits the behaviour but not the reason.

If the change affects `kit/.sdd/`, also check:

- does `docs/lifecycle.md` or `docs/roles.md` still describe reality?
- does `examples/specs/001-driver-scorecard/` still pass `check`?
- does `docs/specs/000-fleet-sdd-framework/` still pass `check`?
- have you run `npm run diagrams` and committed the result? A change to
  `kit/.sdd/flows/feature.md` changes `lifecycle.svg`, and `npm test` fails if
  the committed file is stale.

## Testing

`test/run.mjs` drives the real CLI against real installs in temp directories —
no mocks, because the thing most likely to break is the interaction between the
parser, the ledger and the filesystem, and a mock would hide exactly that.

Add a test for any new validator or command. The suite must stay green on
Node 16; only `sync --apply` may assume Node 18.

## Dogfooding

`docs/specs/000-fleet-sdd-framework/` describes Fleet SDD using Fleet SDD. It is
both the clearest record of how this was built and the strongest acceptance
test — if the framework cannot express its own construction, it is too rigid.
Keep it current.
