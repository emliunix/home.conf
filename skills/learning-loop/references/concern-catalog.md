# Concern catalog

Select one to four concerns whose `applies_when` clauses match the evidence. These entries are
prompts for investigation, not mandatory sections.

```yaml
- id: outcome.frozen-intent
  applies_when: the delivered result, scope, or owner request may have shifted during execution
  question: What did the frozen intent require, what landed, and what remains open?
  evidence: user inputs, goal or design head, final artifact, acceptance result
  failure_pattern: completion is inferred from activity or a stale checklist
  routes: [worklog, open-work register, owning design, acceptance test]

- id: architecture.domain-model
  applies_when: execution corrected an entity, state transition, ownership boundary, or dependency
  question: Did the built system reveal a different domain model or boundary than the design assumed?
  evidence: code paths, schema, runtime trace, rejected design assumption, user correction
  failure_pattern: an implementation workaround preserves a wrong model
  routes: [owning design, type, API, migration, invariant test]

- id: verification.false-green
  applies_when: a check passed while the outcome failed, a test assumption was wrong, or coverage was absent
  question: What did the check actually prove, and what valuable path remained untested?
  evidence: test output, trace, history, manual probe, acceptance mismatch
  failure_pattern: a wrapper exit code, mock, or weak assertion reports success
  routes: [test, trace assertion, test helper, rubric, worklog]

- id: process.time-cost
  applies_when: waits, retries, repeated runs, or administrative steps consumed material time
  question: Which elapsed costs were necessary, which repeated, and what would remove the repeat?
  evidence: timestamps, command durations, retry count, queue or review history
  failure_pattern: process advice is based on annoyance rather than measured cost
  routes: [worklog, script, faster gate, process skill]

- id: process.trap-path
  applies_when: work followed a plausible path that could not answer the question or used a faulty apparatus
  question: What made the path plausible, what falsified it, and what earlier check would have stopped it?
  evidence: search trajectory, failed probes, harness defect, later authoritative source
  failure_pattern: the incident is summarized without a stop rule
  routes: [worklog, skill, fixture, preflight check, linter]

- id: tools.environment
  applies_when: machine, runtime, dependency, network, credential, or tool behavior shaped the result
  question: Is this a stable local fact, a transient incident, or a tool defect?
  evidence: version, command, logs, environment configuration, repeated reproduction
  failure_pattern: a machine-specific fact becomes project-wide policy
  routes: [environment record, setup check, dependency pin, upstream issue]

- id: collaboration.handoff
  applies_when: multiple agents, handoffs, parallel edits, or context loss affected the work
  question: Did ownership, freeze discipline, or the handoff preserve enough evidence for the next actor?
  evidence: agent trajectories, conflicting edits, handoff text, changed revisions
  failure_pattern: readers measure different trees or share an answer key
  routes: [worklog, dispatch skill, ownership rule, batch protocol]

- id: docs.fresh-agent-authority
  applies_when: documentation, onboarding, reading order, or authority changed
  question: Can a fresh agent find the current authority unaided and reject historical alternatives?
  evidence: file-reading trajectory, dead ends, wrong inference, conflicting pointers
  failure_pattern: historical material appears authoritative
  routes: [AGENTS.md, README.md, owning design, rubric, reader batch]

- id: operations.recovery-security
  applies_when: failures, retries, persistence, deployments, permissions, or secrets were involved
  question: What happens after partial failure, replay, timeout, or credential exposure?
  evidence: recovery run, state transition, logs, threat boundary, secret scan
  failure_pattern: happy-path success hides unsafe recovery or leaked material
  routes: [runbook, state machine, invariant test, secret scanner, incident record]
```
