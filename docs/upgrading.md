# Upgrading

Re-running `init` upgrades an install. It will not destroy your work.

```bash
npx fleet-sdd init
```

The design goal is blunt: **any upgrade mechanism that can lose local edits will
stop being run**, and the framework will fossilise at whatever version was first
installed. So three mechanisms cooperate.

## 1. The manifest

`.sdd/.manifest.json` records the hash of every file as installed. On re-init,
each file falls into one of four cases:

| Case | What happens |
| --- | --- |
| Missing | Written. Reported as `created`. |
| Identical to the incoming version | Nothing. Reported as `unchanged`. |
| Present, hash matches the manifest — you never touched it | Upgraded silently. Reported as `updated`. |
| Present, hash differs — you edited it | **Left alone.** Incoming version written as `<name>.new`. Reported as a conflict. |

Hashes are computed on LF-normalised content, so a CRLF checkout on Windows does
not read as a local edit.

```
  2 file(s) you edited locally were left alone.
  The new version sits next to each one as <name>.new -- merge what you want:
    .sdd/constitution.md
    .sdd/roles/architect.md
```

Merge with your usual diff tool, then delete the `.new` file. `fleet-sdd doctor`
lists any you have forgotten.

## 2. Marked blocks

Three files belong to your repo as much as to Fleet SDD: `AGENTS.md`,
`CLAUDE.md`, and `.gitignore`. For these, only the text between our markers is
ever replaced:

```markdown
<!-- fleet-sdd:begin -->
... managed content ...
<!-- fleet-sdd:end -->

## Our own conventions
Anything here is untouched, forever.
```

`.gitignore` uses `# >>> fleet-sdd >>>` / `# <<< fleet-sdd <<<`.

Content outside the markers survives every upgrade. If the markers are missing,
the block is appended rather than replacing the file.

## 3. Overrides — the option to prefer

`.sdd/overrides/<path>` shadows `.sdd/<path>` and is **never touched by an
upgrade**.

```
.sdd/roles/architect.md              # shipped
.sdd/overrides/roles/architect.md    # yours -- wins, survives upgrades
```

Works for roles, flows, checklists, templates and `config.yml`. Overridden roles
show as `[override]` in `fleet-sdd roles`, and `doctor` lists every override, so
they never become invisible surprises.

**Editing in place vs overriding:**

| | Edit in place | Override |
| --- | --- | --- |
| Survives upgrade | Yes, but you get a `.new` to merge each time | Yes, untouched |
| You see upstream improvements | Yes, in the `.new` file | No — you own it now |
| Best for | Small tweaks you want to keep reconciling | Anything you intend to keep permanently |

Override the files you have genuinely made your own — a rewritten role, a
constitution rebuilt from scratch. Edit in place where you want to keep seeing
what upstream changed.

## Checking an install

```bash
npx fleet-sdd doctor
```

```
  node       v20.11.0
  kit        found D:/fleet-iq-sdd/kit
  repo       D:/my-product
  roles      14
  flows      3 (bugfix, feature, spike)
  specs      7 in docs/specs/
  manifest   45 tracked, 2 locally edited, 0 missing
  overrides  1 file(s) shadowing the shipped kit
             roles/architect.md
  claude     installed
  cursor     not installed
```

Then `npx fleet-sdd check` for content validation — `doctor` checks the install,
`check` checks the work.

## When an upgrade adds a gate

New gates do not retrofit into existing ledgers. `check` reports it:

```
error   docs/specs/003-telemetry/gates.yml: required gate "operate.detection" is missing from the ledger
```

Two honest options:

- **Adopt it** — add `operate.detection: { status: pending }` to the ledger and
  do the work.
- **Leave that feature on the old set** — pin it by listing the gates it needs
  as a tier in `config.yml`, or waive the new gate with a reason.

There is deliberately no automatic backfill. Silently inserting a gate into a
feature that already shipped would either produce a false `pending` on finished
work or, worse, a false `approved`.

## Adding an adapter later

```bash
npx fleet-sdd init --adapters=claude,cursor,copilot
```

Additive — existing adapter files follow the same manifest rules.

## Dry run

```bash
npx fleet-sdd init --dry-run
```

Reports what would change and writes nothing.

## Rolling back

Fleet SDD writes only into `.sdd/`, `.claude/`, `.cursor/`, `.github/`,
`docs/specs/`, and the marked blocks of `AGENTS.md`, `CLAUDE.md` and
`.gitignore`. Every one of those is in git.

```bash
git diff .sdd
git checkout -- .sdd
```

There is no state anywhere else — no database, no server, no cache. That is on
purpose.
