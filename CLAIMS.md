# Claims

| Claim | State | Evidence / limitation |
| --- | --- | --- |
| Server creates occupation IDs, exposes them over SSE and rejects a supplied stale ID with 409 | PROVEN_IN_TEST | 22 targeted tests passed; full CI 163 passes |
| Client automatically propagates target-table ID | PROVEN_IN_TEST | actual send() and realtime handler tested with real HTTP/SSE; full CI passed |
| Strong diner authentication | IDEA | NOT PROVIDED by mesaSessionId |
| Legacy requests cannot bypass session comparison | IDEA | FALSE: omitted/null/empty IDs remain compatible |

No production or pilot claims are made. See PROOF/RVO-20260929-001 for results.
