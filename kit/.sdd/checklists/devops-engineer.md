# Checklist — DevOps Engineer

## `build.pipeline`
- [ ] Build, test and lint run on every change
- [ ] Dependency and container scanning run
- [ ] It is clear which checks **block a merge** and which only report
- [ ] Infrastructure changes reviewed like application code
- [ ] Configuration and secrets managed outside the repository
- [ ] No secrets in CI logs or image layers
- [ ] Deployment is repeatable — running it twice gives the same result
- [ ] `evidence.md#pipeline` records what runs and what blocks

## `operate.release` — you are the last gate
- [ ] Rollback has been **executed**, not assumed. Date recorded.
- [ ] Deploy and rollback commands written verbatim in `runbook.md`
- [ ] Feature flags named, with default states
- [ ] Configuration documented, including behaviour when a setting is absent
- [ ] Dependencies that must be healthy first are listed
- [ ] Smoke check defined, and the signal that says roll back
- [ ] Migrations have a reverse path, or its absence is justified in writing
- [ ] `operate.monitoring` is cleared — alerts are live before release
- [ ] `operate.support-readiness` is cleared — support has been briefed
- [ ] You are approving on evidence, not on trust. Otherwise this gate is
      decorative.
