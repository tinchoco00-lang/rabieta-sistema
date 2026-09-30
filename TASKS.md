# Tasks

| ID | Objective / plan | Status | Evidence gate |
| --- | --- | --- | --- |
| RVO-001 | Create state, tasks, decisions, claims and proof control plane | READY_FOR_HUMAN | local gates passed; branch and PR CI green on 32114c9 |
| RVO-002 | Inject the current target-table session centrally in client send; test real HTTP/SSE lifecycle and audit | READY_FOR_HUMAN | 22 targeted passes; full CI 163 passes; audit recorded |
| RVO-003 | Assess stricter legacy/session policy without changing compatibility | PROPOSAL_WRITTEN | docs/RVO-003-session-policy-proposal.md; runtime capability remains IDEA |

On failure: record command and fingerprint, diagnose, correct, retest. Escalate
after three attempts with the same fingerprint. Never promote on unverified claims.
