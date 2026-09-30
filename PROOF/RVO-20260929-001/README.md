# RVO-20260929-001

Result: PASS on verified revision 32114c9bdfdff82a68c69a51a0a6d76ba965d2f9.
Execution date: 2026-09-30. Evidence-only follow-up commits require their own CI.

Objective: evidence control plane and centralized propagation of the current
target-table occupation ID from cliente send(). No server enforcement change.

Base: f4aee0746beff29491dc55e2946c443dcc1e57bc.
Implementation/test revision: 487feb68a4f3b3d3822f0fcfcd3a2dd9387ed273.
Subsequent proof-only commits record results without changing executable code.

## Evidence

- input.json: test scenarios and commands.
- output.json: actual local gate results and timestamps.
- environment.md: environment and interventions.
- logs/targeted-tests.txt and logs/npm-run-check.txt: captured command output.
- audit.md: explicit BUILDER → AUDITOR review and limitations.

Initial full check: 163 tests, 157 passed, 6 skipped, 0 failed.
The six skips require real PostgreSQL, supplied by remote CI.
Remote branch CI: 163 passed, zero failures, zero skips.
Branch run: https://github.com/tinchoco00-lang/rabieta-sistema/actions/runs/36716615161
PR run: https://github.com/tinchoco00-lang/rabieta-sistema/actions/runs/36716724600
Both concluded success on revision 32114c9. PR: https://github.com/tinchoco00-lang/rabieta-sistema/pull/52
Payments use the suite's mock provider; no live financial transaction occurred.

## Retry history

1. GitHub access/config read denied in sandbox; approved direct CLI retry succeeded.
2. npm.ps1 denied by PowerShell execution policy; npm.cmd succeeded without policy changes.
3. First targeted run: one pass, one failure in the test's cross-VM deepStrictEqual.
   Actual and expected serialized table values matched; their prototypes belonged
   to different JavaScript realms. Normalize both to host JSON before comparison.
   Retest: 22 passed, zero failures. This was a test-harness fix, not a server fix.
4. Visible Computer Use blocked by URL-policy verification; no attempt to bypass it.
5. Rewriting captured PowerShell logs as UTF-8 returned access denied, including
   one elevated retry. Original UTF-16 logs retained intact; read with Get-Content.
   This does not affect test execution. Secret-pattern scan decoded those logs
   with Select-String and returned no matches.

No repeated fingerprint reached three attempts. Original local changes preserved.
No deployment or merge performed. Human review remains required.
