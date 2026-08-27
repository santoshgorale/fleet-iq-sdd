# Fleet SDD framework — runbook

> `000-fleet-sdd-framework` · created 2026-08-21
>
> For the person maintaining the framework, and the person helping a team that
> is stuck on it.

## Monitoring and alerting

There is no runtime, so there is nothing to page. The signals are all in CI and
in two commands.

| Alert | Severity | Means | First action | Escalate to | Dashboard |
| --- | --- | --- | --- | --- | --- |
| Test suite red | S2 | `npm test` failed | Read the failing test name. The suite has no mocks, so a failure is a real behaviour change, not a broken double. | Framework maintainer | CI output |
| Kit fails its own check | S2 | `check` on a fresh install exits 1 | The shipped roles and flows disagree. Almost always a gate added to a flow with no owning role, or a role id not matching its filename. | Framework maintainer | CI output |
| Bundled specs drift | S3 | `check` on the worked example or this spec exits 1 | A schema change made them invalid. **Fix the example, not the validator** — the example is the documentation. | Framework maintainer | CI output |
| Node matrix failure on 16 only | S3 | A Node 18+ API crept in | Find the API and replace it. Only `sync --apply` may assume 18. | Framework maintainer | CI output |

**Dashboards**

| Dashboard | Link | Use it when |
| --- | --- | --- |
| `fleet-sdd doctor` | run it in the repo | Asked "is my install healthy?" |
| `fleet-sdd status` | run it in the repo | Asked "where is the work?" |

**Signals that are normal**

- `check` reporting a warning about a role that owns no gates. Legal, and
  sometimes deliberate for a purely advisory role.
- A warning that a gate's owner is not listed in the stage using it. Usually a
  genuine mistake, occasionally intentional when a specialist signs off across
  stages.
- `doctor` reporting locally edited files. That is teams using the framework as
  intended, not drift to be corrected.
- `check` flagging a required gate missing from an older feature's ledger right
  after a flow gains a gate. Expected — there is deliberately no backfill.

## Operations

**Install into a product repo**

```bash
cd your-product-repo
npx fleet-sdd init                                    # Claude adapter only
npx fleet-sdd init --adapters=claude,cursor,copilot   # all three
npx fleet-sdd init --dry-run                          # report, write nothing
```

**Upgrade**

```bash
npx fleet-sdd init          # same command; manifest decides what is safe
npx fleet-sdd doctor        # then check for unmerged .new files
```

**Rollback**

```bash
git diff .sdd .claude .cursor .github AGENTS.md CLAUDE.md
git checkout -- .sdd .claude .cursor .github AGENTS.md CLAUDE.md
```

Everything the tool writes is in git. There is no other state — no cache, no
daemon, no database. Rollback last tested: **2026-08-21**, on a scratch repo.

**Release the framework itself**

```bash
npm test                                # must be green on Node 16 and 20
node cli/sdd.mjs init --into /tmp/verify --dry-run
npm version <patch|minor|major>
npm publish
```

Bump `VERSION` in `cli/sdd.mjs` and `install.mjs` together — they are read
independently, and a mismatch shows up in the manifest rather than failing
loudly.

**Feature flags**

| Flag | Default | Effect when off |
| --- | --- | --- |
| `--adapters=none` | n/a | Installs `.sdd/` and the context files, no editor adapters |
| `--dry-run` | off | Reports what would change, writes nothing |
| `--apply` (sync) | off | Without it, `sync` never contacts the tracker |

**Configuration**

| Setting | Where it lives | Behaviour if absent |
| --- | --- | --- |
| `specsDir` | `.sdd/config.yml` | Defaults to `docs/specs` |
| `defaultFlow` / `defaultTier` | `.sdd/config.yml` | Default `feature` / `standard`; `check` errors if either names something undefined |
| `tracker.projectKey` | `.sdd/config.yml` | `sync` refuses with a clear message |
| `SDD_USER` | Environment | Falls back to `GIT_AUTHOR_EMAIL`, then `git config user.email`, then `unknown` |
| `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` | Environment **only** | `sync --apply` refuses and names the missing variables |
| `NO_COLOR` | Environment | Colour on when stdout is a TTY |

**Health**

- **Dependencies that must be healthy first:** a filesystem. That is all.
- **Smoke check confirming a good release:**
  ```bash
  node cli/sdd.mjs init --into /tmp/smoke && cd /tmp/smoke && \
    node cli/sdd.mjs new "Smoke test" && node cli/sdd.mjs next && node cli/sdd.mjs check
  ```
  Expect exit 0 from `check` and `next` naming the `frame` stage.
- **Signal that says roll back:** `check` failing on a fresh install of the kit.
  That means the framework ships inconsistent roles and flows, and every team who
  upgrades gets a red validator.

## Support

**What teams will ask**

| In their words | What is actually happening | What to tell them |
| --- | --- | --- |
| "`check` fails and I haven't changed anything." | A flow gained a gate; older ledgers do not have it. | Add the gate as `pending`, or waive it with a reason. There is no backfill on purpose — it would silently mark finished work as pending, or worse, as approved. |
| "It overwrote my role file." | It did not. The edit is intact and the new version is `<name>.new`. | Point at the file. Then suggest `.sdd/overrides/` for anything they intend to keep. |
| "Every file shows as edited on Windows." | Line endings. | Check `.gitattributes` is present. Hashes are computed on LF-normalised content precisely to avoid this. |
| "`next` says there are several features." | No current feature set, and more than one exists. | Name it: `fleet-sdd next 003`. `new` sets the current feature; `.sdd/.current` is per developer and gitignored. |
| "The agent approved its own gate." | Someone edited `gates.yml` directly, or the adapter instructions were removed. | Every adapter says never to approve. Re-run `init` to restore them. |
| "This is too much ceremony for a small change." | They are using tier `standard` for tier `tiny` work. | `--tier tiny` trims to four gates. If `tiny` is still too much, that is a real signal — see below. |

**Triage**

Ask three things, in order:

1. **`fleet-sdd doctor`** — install health, local edits, overrides, unmerged
   `.new` files. Resolves most "it's behaving oddly" reports on its own.
2. **`fleet-sdd check`** — is this a content problem or a tooling problem? A
   named file and line means content.
3. **Which command, and what exact output?** Every user-facing error names the
   file and the next action. A message that does not is a bug worth fixing rather
   than explaining.

**Diagnostics anyone can run themselves**

| Check | Where | What it tells you |
| --- | --- | --- |
| `fleet-sdd doctor` | The repo | Install health, drift, overrides, stale `.new` files |
| `fleet-sdd check` | The repo | Every content problem, with file and reason |
| `fleet-sdd roles` | The repo | What roles exist, including local additions and overrides |
| `fleet-sdd status` | The repo | Every feature, its stage, its blockers |
| `node --version` | Anywhere | Whether a Node 18 API is the problem |

**Escalation**

| Severity | Means | Team / rota | Channel | Must attach |
| --- | --- | --- | --- | --- |
| S1 | An upgrade destroyed someone's work | Framework maintainers | `#fleet-sdd` | The repo, the file, `doctor` output, the git diff |
| S2 | `check` reports an error that is wrong, or misses a real one | Framework maintainers | `#fleet-sdd` | The `.sdd/` file, the ledger, the exact output |
| S3 | A gate consistently produces no value | Framework maintainers **and** the team's Product Owner | `#fleet-sdd` | Which gate, how often it is waived, and what a rejection would have looked like |
| S4 | Request for a new role, flow or adapter | Framework maintainers | `#fleet-sdd` | What it would own and which gates it would sign |

S1 is the one to memorise: losing local edits is the failure that would end
adoption of the framework, because a tool that eats work stops being run. Treat
any report of it as urgent even if it turns out to be a `.new` file the person
did not notice.

S3 is the one most likely to be under-reported, and it is genuinely welcome —
`.sdd/constitution.md` P10 says a gate producing no value should be deleted. A
cluster of waivers on the same gate is evidence the gate is wrong, not that the
team is lax.

**Known limitations and workarounds**

| Limitation | Workaround | Mirror into spec.md#known-issues |
| --- | --- | --- |
| New gates are not backfilled into existing ledgers | Add as `pending`, or waive with a reason | Yes |
| `sync --apply` needs Node 18 | Use Node 18+, or create issues manually | Yes |
| YAML parser is a subset | Keep `.sdd/` files to block maps, sequences, flow collections and block scalars | Yes |
| Tier `tiny` on `spike` drops `spike.finding` | Run spikes at `standard` | Yes |

**Customer-visible messages**

| Message | What it actually means |
| --- | --- |
| "No .sdd/ directory found in this repo or any parent." | Not installed here. Not a fault. |
| "Several features exist -- name the one you mean" | No current feature set. Pass a name. |
| "required gate ... is missing from the ledger" | A flow gained a gate after this feature was created. |
| "stage ... is signed off but ... placeholders remain" | Someone approved unfinished work. The framework working as designed, not a bug. |
| "gate ... is not owned by any role -- nobody can sign it off" | A flow references a gate no role claims. Framework or local config error. |
| "Waiving a gate needs a reason" | Add `-m "why"`. Waivers are permanent record. |

**Enablement**

- Team briefed on: framework introduction session, plus
  [docs/quickstart.md](../../quickstart.md) as the self-serve path.
- Docs updated: seven documents under `docs/`, plus `.sdd/EXTENDING.md` shipping
  inside every install so the extension path travels with the kit.
- Release note drafted: `README.md` is the release note for v1.
