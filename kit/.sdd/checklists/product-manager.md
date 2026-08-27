# Checklist — Product Manager (`spec.product`)

Work through this before approving. If an item is genuinely not applicable,
strike it and say why in the gate note.

## The problem is real
- [ ] Problem describes a pattern with evidence, not a single request
- [ ] Named users, and what they are trying to get done
- [ ] Someone outside the team could read it and understand who is affected

## Scope is honest
- [ ] In-scope list is specific
- [ ] Out-of-scope list is non-empty
- [ ] Anything cut during discussion is recorded, not just dropped

## Criteria are usable
- [ ] Each criterion describes an outcome, not an implementation
- [ ] Each could be turned into a failing test today, without asking you anything
- [ ] No "etc.", "and so on", or "as appropriate"
- [ ] Error and edge behaviour is specified, not only success

## Measures exist
- [ ] Each success measure names a metric, a baseline and a target
- [ ] Each is instrumentable — check with the Observability Engineer
- [ ] You would be willing to be judged on these numbers in a quarter

## Clean
- [ ] No `TODO(sdd)` markers remain in `spec.md`
- [ ] Open questions either answered or assigned with a date
