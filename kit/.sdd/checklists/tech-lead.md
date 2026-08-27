# Checklist — Technical Lead (`build.code-review`)

## Against the agreement, first
- [ ] The change does what `design.md` said it would
- [ ] Any deviation is either reverted or reconciled *into* `design.md`
- [ ] Acceptance criteria in `spec.md` are actually met by this code
- [ ] Failure modes from `design.md` are handled, not just the happy path

## The code
- [ ] Matches the conventions of the surrounding code
- [ ] Names say what things are; no comments explaining bad names
- [ ] Errors handled deliberately — nothing swallowed silently
- [ ] No commented-out code, stray debug output, or `TODO` without an owner
- [ ] No secrets, credentials or personal data in code, tests or fixtures

## Tests
- [ ] Every acceptance criterion has a test
- [ ] Failure paths tested, not only success
- [ ] Tests would fail if the behaviour regressed — check by breaking one
- [ ] Full suite green, including tests unrelated to this change

## Task hygiene (during `slice`)
- [ ] Every task is independently mergeable
- [ ] Every task names the files or modules it touches
- [ ] Dependencies between tasks are explicit
- [ ] Integration risk is sequenced early, not last
- [ ] No task requires a conversation before it can be started
