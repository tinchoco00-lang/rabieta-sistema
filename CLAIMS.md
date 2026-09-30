# Claims

| Claim | State | Evidence / limitation |
| --- | --- | --- |
| Server creates occupation IDs, exposes them over SSE and rejects a supplied stale ID with 409 | PROTOTYPE | server.js and existing trust.server.test.js; execution pending |
| Client automatically propagates target-table ID | TESTING | public/app.js send(); execution pending |
| Strong diner authentication | IDEA | NOT PROVIDED by mesaSessionId |
| Legacy requests cannot bypass session comparison | IDEA | FALSE: omitted/null/empty IDs remain compatible |

No production or pilot claims are made. See PROOF/RVO-20260929-001 for results.
