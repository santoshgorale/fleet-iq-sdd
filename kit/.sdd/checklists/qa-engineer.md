# Checklist — QA Engineer

## `prove.functional`
- [ ] Every acceptance criterion has a recorded result
- [ ] Any criterion you could not test is named, with the blocker
- [ ] Every UX state from `spec.md#experience` exercised: empty, loading, partial,
      error, permission denied, offline
- [ ] Failure modes from `design.md` deliberately induced and observed

### Edges the spec did not mention
- [ ] Empty input, and maximum input
- [ ] Duplicate submission
- [ ] Concurrent edits by two users
- [ ] Expired session mid-flow
- [ ] Permission changed mid-flow
- [ ] Browser back button, and refresh mid-operation

### Evidence quality
- [ ] Environment and test data recorded alongside results
- [ ] Every defect names the criterion it violates
- [ ] Every defect has reproduction steps someone else can follow unaided
- [ ] Sign-off rests on what you observed, not on a green pipeline

## `spec.reproduction` — bug fixes
- [ ] Steps, expected, actual all written down
- [ ] Frequency recorded — e.g. 3 of 5 attempts
- [ ] Environment recorded
- [ ] Someone else has reproduced it using only your steps
- [ ] If it is intermittent, that is stated rather than glossed over
