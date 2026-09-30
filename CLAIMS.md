# Claims

| Claim | State | Evidence / limitation |
| --- | --- | --- |
| Server creates occupation IDs, exposes them over SSE and rejects a supplied stale ID with 409 | TESTING | 22 targeted tests passed; CI pending |
| Client automatically propagates target-table ID | TESTING | actual send() and realtime handler tested with real HTTP/SSE; CI pending |
| Strong diner authentication | IDEA | NOT PROVIDED by mesaSessionId |
| Legacy requests cannot bypass session comparison | IDEA | FALSE: omitted/null/empty IDs remain compatible |

No production or pilot claims are made. See PROOF/RVO-20260929-001 for results.
