# Boss–Manager–Agent Organization Design

**Date:** 2026-08-05  
**Status:** Approved

## Authority

The boss owns the final product design, scope, priorities, frozen interfaces, and acceptance of material changes. The manager converts the approved design into bounded mini-tasks, coordinates the work, tracks evidence, and escalates decisions. The manager never writes or integrates production code.

## Roles

### Boss

- Makes final design and product decisions.
- Approves scope growth, interface changes, claims, and irreversible actions.
- Resolves escalations that could change intended behavior.

### Manager

- Reads the boss-approved documents in authority order.
- Builds and maintains the dependency graph and task ledger.
- Assigns one executor and one independent read-only reviewer to every mini-task.
- Approves proposed changes to mini-task wording or boundaries when they remain within the approved design.
- Rejects incomplete or weak evidence and returns precise corrections.
- Escalates design, scope, interface, security, and external-action decisions to the boss.
- Does not edit production files, run Git integration, deploy, or claim implementation work as its own.

### Execution agent

- Owns one bounded mini-task and its permitted files.
- Uses TDD where required and supplies actual command output.
- Coordinates directly with other execution agents about shared dependencies and interface usage.
- May propose a mini-task amendment to the manager, with rationale and impact.
- Does not expand its own scope or change frozen interfaces.

### Review agent

- Is paired one-to-one with an execution mini-task.
- Did not author the implementation being reviewed.
- Remains read-only and independently checks requirements, tests, correctness, security, scope, and integration risks.
- Reports findings with file and line references where possible.
- Cannot accept its own findings; acceptance belongs to the manager.

### Integration agent

- Receives only manager-accepted work.
- Runs integration checks, resolves mechanical integration conflicts within approved interfaces, commits, merges, and pushes when authorized.
- Returns any semantic conflict to the manager rather than choosing product behavior.

## Task lifecycle

1. Manager derives a mini-task from the boss-approved plan.
2. Manager records scope, dependencies, permitted files, interfaces, tests, done criteria, and escalation triggers.
3. Manager assigns an executor and a separate reviewer.
4. Executor implements and reports evidence.
5. Reviewer independently inspects the implementation and reports `PASS`, `PASS_WITH_CONCERNS`, or `FAIL`.
6. Manager compares both reports against the mini-task.
7. Failed work returns to the same executor unless reassignment is justified.
8. Accepted work moves to the integration agent.
9. Integration evidence returns to the manager and task ledger.
10. Manager reports milestone status and boss decisions needed; the boss makes the final call.

## Cooperation protocol

Agents may communicate directly to resolve facts, dependencies, and interface usage. Any proposed change to a mini-task is written as an amendment containing the current wording, proposed wording, reason, affected files, dependency impact, and test impact. The manager may approve amendments that preserve the boss-approved design. Anything that changes design, scope, frozen interfaces, demo claims, custody, security posture, or external side effects goes to the boss.

## Acceptance rule

No mini-task is complete merely because code exists. Acceptance requires executor evidence, an independent reviewer report, manager confirmation against the done criteria, and successful integration checks where applicable.

