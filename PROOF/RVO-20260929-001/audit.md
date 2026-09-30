# BUILDER → AUDITOR

Reviewed public action transport, server session guard and mutation queue,
new tests, existing payment/review/staff suites, claims and proof content.

- Only public/app.js send() posts to /api/action in public/. Other fetch calls
  are SSE, staff logout, network discovery or table-link reads.
- Injection uses payload.mesa, not clienteMesa, copies the payload and reads
  state.mesas on each call. Staff role bypasses injection.
- Real HTTP/SSE tests establish A, send second/concurrent rounds with A, request
  account with A, pay/free via staff, establish B, reject concurrent A replays
  with 409 and compare the complete table before/after. B then succeeds.
- Wrong-table ID is rejected by the server; send selects the correct table ID.
- Reopened SSE snapshot and new VM client reload both obtain and send B.
  This tests snapshot handling, not a full browser network outage/reconnect UI.
- Full suite covers payment sandbox, mocked Mercado Pago, reviews, role access,
  queue authorization and privacy. No live payment-provider validation claimed.
- No new BLOCKER/HIGH found within the agreed propagation-only scope.
- Proof logs contain test names and timings, not production data or credentials.

## Remaining limitations (not fixed by this patch)

1. Legacy, omitted, null and empty IDs remain accepted (tested). Requests before
   the first SSE snapshot therefore have no occupation comparison.
2. Server guard requires an occupied table. A stale request against a free table
   may create a new occupation (source audit); IDs do not provide universal replay prevention.
3. A stale browser receiving B through SSE may act with B. Occupation identifiers
   are not strong diner authentication or proof of membership in that occupation.
4. In-flight requests serialize their ID when send() runs; the server evaluates
   that ID against state in the mutation queue. Concurrent same-occupation orders
   work; duplicate-order idempotency is outside this change.
5. Six real PostgreSQL tests skip locally. CI must run them before readiness.

RVO-003 next safe action: document a compatibility migration proposal for
server-required session IDs and occupation membership, without changing server
policy, deploying or silently breaking legacy clients.
