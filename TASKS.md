# Tasks

| ID | Objective / plan | Status | Evidence gate |
| --- | --- | --- | --- |
| RVO-001 | Create state, tasks, decisions, claims and proof control plane | IN_PROGRESS | diff check, npm ci, full check, CI |
| RVO-002 | Inject the current target-table session centrally in client send; test real HTTP/SSE lifecycle and audit | IN_PROGRESS | targeted tests, full check, audit, CI |
| RVO-003 | Assess stricter legacy/session policy without changing compatibility | PROPOSAL_WRITTEN | docs/RVO-003-session-policy-proposal.md; runtime capability remains IDEA |

On failure: record command and fingerprint, diagnose, correct, retest. Escalate
after three attempts with the same fingerprint. Never promote on unverified claims.
