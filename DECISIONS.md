# Decisions

- 2026-09-30: Start from freshly fetched origin/main in an isolated worktree;
  preserve existing uncommitted Trust work.
- Keep session injection in send(), only for cliente, using payload.mesa.
  Never cache a session independently from the current state.mesas snapshot.
- Preserve the server's optional-ID compatibility contract. Mandatory here means
  automatic propagation by this client when a current ID is known, not server enforcement.
- No deployment and no automatic merge. Human review follows green CI.
- Use npm.cmd on Windows: npm.ps1 is blocked by the existing execution policy.
- Computer Use inspection was blocked because the helper could not establish the
  browser URL; continue with direct tools as requested, without bypassing that block.
