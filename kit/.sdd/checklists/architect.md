# Checklist — Architect (`design.architecture`)

## The design is a decision
- [ ] Approach explains *why*, not only *what*
- [ ] At least one real alternative documented with the reason it lost
- [ ] Prose accompanies every diagram

## Data
- [ ] System of record named for every entity touched
- [ ] Retention stated
- [ ] Migrations identified, with their order

## Interfaces
- [ ] Every added or changed contract listed
- [ ] Breaking changes called out explicitly, or their absence asserted
- [ ] Compatibility plan for anything breaking

## Failure
- [ ] Every dependency has a stated behaviour when slow, down, and returning garbage
- [ ] Blast radius stated for each
- [ ] Timeouts and retry behaviour specified, including whether retries are safe

## Reversibility
- [ ] Rollout described, including flags and phasing
- [ ] Rollback described — or its impossibility stated in writing and justified

## Inputs for the specialist gates
- [ ] Trust boundaries marked, so Security is not guessing
- [ ] Hot paths marked, so Performance is not guessing
- [ ] Data flows marked, so Observability is not guessing
- [ ] No open `changes-requested` on `design.security`, `design.performance` or
      `design.observability`

## Clean
- [ ] No `TODO(sdd)` markers outside sections owned by other roles
