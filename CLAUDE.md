## Repo instructions

@AGENTS.md

## Reminders specific to this repo

**This repo is the framework, not a consumer of it.** Content for product repos
goes in `kit/`. Logic goes in `cli/`. Do not mix them — the split is what keeps
the CLI free of opinions.

**Never add a dependency.** `package.json` has an empty `dependencies` block on
purpose. If something seems to need a library, it probably needs less code
instead.

**Run `npm test` before claiming a change works.** 43 tests, a couple of seconds,
no setup.

**Adding or changing a gate, role, flow or artifact** means updating
`docs/decisions.md`, and checking that `docs/lifecycle.md`, `docs/roles.md`, the
worked example and `docs/specs/000-fleet-sdd-framework/` still hold.

To try a change end to end:

```bash
node cli/sdd.mjs init --into /tmp/scratch && cd /tmp/scratch && node D:/fleet-iq-sdd/cli/sdd.mjs next
```
