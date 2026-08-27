---
description: Every SDD feature, its stage, and what is blocking it
allowed-tools: Bash(npx fleet-sdd:*), Bash(fleet-sdd:*), Read
---

# /sdd:status

```bash
npx fleet-sdd status
```

Then read the result rather than just relaying it. Useful things to say out loud:

- **Where the work is piling up.** Several features blocked on the same gate
  usually means one role is a bottleneck, or that gate is badly specified. Name
  the pattern; the table on its own does not.
- **Features stalled on `changes-requested`.** These are the expensive ones —
  work is done, someone rejected it, and nobody has picked it back up.
- **Anything in `operate`.** Built, not yet supportable. Easy to forget precisely
  because the code is finished.
- **Waivers.** Run `npx fleet-sdd check` too; it warns about gates signed off
  when the tier did not require them, and about waivers. A cluster of waivers on
  the same gate is a signal the gate is wrong, not that the team is lax.

Offer the obvious next action for whichever feature the user cares about, as a
command they can run.
