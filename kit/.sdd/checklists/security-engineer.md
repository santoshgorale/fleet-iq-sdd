# Checklist — Security Engineer

## `design.security` — the threat model
- [ ] Assets named: what an attacker would actually want here
- [ ] Every trust boundary identified, with its enforcement point
- [ ] Threats walked across spoofing, tampering, repudiation, information
      disclosure, denial of service and elevation of privilege
- [ ] Each applicable threat has a mitigation, or is explicitly accepted with a reason
- [ ] Every mitigation is testable — otherwise it is an intention
- [ ] Authorisation enforced server-side, and stated as such
- [ ] Input validation specified at every boundary, not just the outer one

## Personal data
- [ ] Inventory covers what is collected and why
- [ ] Storage location and retention period stated
- [ ] Deletion path exists
- [ ] Logs, metrics, traces and analytics reviewed — this is where it leaks
- [ ] No identifiers that become personal in combination

## Secrets
- [ ] Every secret needed is named
- [ ] Storage mechanism specified, outside the repository
- [ ] Rotation procedure stated

## `prove.security` — verification
- [ ] Every mitigation verified against the running system
- [ ] Attempts that failed to break it recorded — negative results are evidence
- [ ] Authorisation tested with a genuinely unauthorised principal
- [ ] Dependency and container scanning run, with findings triaged
- [ ] Findings not fixed are recorded as accepted residual risk
- [ ] Verification rests on more than a passing scanner
