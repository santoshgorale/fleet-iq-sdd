# Diagrams

Four views of the framework, as plain SVG.

| File | Shows | Source |
| --- | --- | --- |
| [`lifecycle.svg`](lifecycle.svg) | The six stages of the `feature` flow, with each stage's artifact, roles and gates | **Generated** from `kit/.sdd/flows/feature.md` and the role files |
| [`sdlc-stlc-mapping.svg`](sdlc-stlc-mapping.svg) | Fleet SDD stages against SDLC and STLC phases | Hand-authored in `build.mjs` |
| [`integrations.svg`](integrations.svg) | AI tooling, the repo, and third-party trackers via adapters | Hand-authored in `build.mjs` |
| [`skills.svg`](skills.svg) | How skills compose with `.sdd/` | Hand-authored in `build.mjs` |

**To view them all at once**, open [`index.html`](index.html) in a browser. No
server needed — it is a static file.

## Why SVG and not Mermaid

Mermaid renders on GitHub and almost nowhere else — not in VS Code without an
extension, not in most Markdown previews, not in a PDF export, and not in the
file cards this project's tooling produces. The README used Mermaid first and the
diagrams were simply invisible for anyone not reading on github.com.

An `<img>` pointing at an SVG renders everywhere, stays crisp at any zoom, and
still diffs as text in git.

Each diagram paints its own light background, so it stays legible against a dark
README theme rather than becoming dark-on-dark.

## Regenerating

```bash
npm run diagrams
```

`npm test` regenerates them in memory and compares against what is committed, so
a stale diagram fails the build. If a test tells you diagrams are stale, run the
command above and commit the result.

## Why the lifecycle diagram is generated

It reads the actual flow definition through the same YAML parser the CLI uses.
Add a gate to `kit/.sdd/flows/feature.md` and the diagram grows a row; add a
sixth stage and it grows a column. A hand-drawn version would have been accurate
for about a week — this one cannot drift, and the test proves it.

The other three describe relationships that have no machine-readable source
(how SDLC phases correspond to stages, which tools exist in the world), so they
are authored directly in [`build.mjs`](build.mjs).

## Editing

Everything lives in [`build.mjs`](build.mjs) — around 500 lines, zero
dependencies, with small `text()` / `rect()` / `line()` helpers rather than a
graphics library.

Two conventions worth keeping:

- **Paint an explicit background.** Every diagram starts with a full-bleed white
  rect. Without it, dark-theme readers get dark text on a dark page.
- **Highlight the four late-arriving disciplines.** Security, Performance,
  Observability and Support are marked with `◆` and an amber accent wherever
  they appear, because their placement at *design* time is the single idea the
  diagrams exist to communicate.
