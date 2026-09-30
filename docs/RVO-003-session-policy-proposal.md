# RVO-003: occupation policy proposal

Status: IDEA. Analysis only; no runtime policy change or rollout authorized.

RVO-002 propagates known IDs. It does not prevent an anonymous legacy request
from omitting the ID or a previous visitor from learning the next ID over SSE.

## Proposed next objective

Define an occupation-membership contract before making IDs mandatory on the
server. Separate the table's long-lived QR access from a short-lived occupation
credential. Decide who can admit a new visitor to an existing occupation, how
shared devices behave, how credentials expire, and how staff can recover access.

## Migration gates

1. Measure missing-ID requests without storing tokens or diner identifiers.
2. Version the client/API contract and define a legacy sunset plus rollback.
3. Specify an atomic free-table first-order handshake: concurrent requests must
   not accidentally join a newly created occupation merely because they lacked an ID.
4. Require the credential on occupied-table mutations; separately authorize SSE
   access so a previous occupation cannot obtain the next credential by reconnecting.
5. Test free-table races, expired membership, multiple diners, offline retries,
   duplicate orders, payments/reviews after closure and staff overrides.
6. Pilot only after human approval of compatibility impact and proof of the new
   security contract. This document neither starts a pilot nor permits deployment.

Open product decision: can a static table QR grant membership automatically, or
must staff/current occupants admit a diner? A static public QR alone cannot prove
physical presence. Resolve this before promising strong diner authentication.
