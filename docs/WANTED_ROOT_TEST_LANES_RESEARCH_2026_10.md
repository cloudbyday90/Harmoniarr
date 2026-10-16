# Wanted root test lanes: official practices

Consulted 2026-10-16 through MCP search, opening and official-page navigation.
GitHub repository metadata supplied its canonical URL and PR collection URL;
the opening collection had no open PR to apply or rebase.

| Official source and status | Applicable practice | Implementation/evidence |
| --- | --- | --- |
| [Node 24 test runner](https://nodejs.org/download/release/v24.20.0/docs/api/test.html), versioned API documentation | Explicit file/glob selection, asynchronous test completion and cancellation must be understood separately | Retain the canonical routine glob; place the scaling service outside it; await actual scenario work and cleanup |
| [Node 24 CLI](https://nodejs.org/download/release/v24.20.0/docs/api/cli.html), versioned API documentation | Name/skip filters change which cases execute; timeout config bounds execution | Use a named explicit benchmark mode instead of silent filters; preserve per-scenario bounds |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/), Working Draft 2026-09-01 | Monotonic elapsed time avoids system-clock adjustment | Preserve performance.now observations and separate timing from correctness, work counts and user-facing dates |
| [PostgreSQL 18 ROLLBACK](https://www.postgresql.org/docs/18/sql-rollback.html), versioned database documentation | Rollback discards transaction updates; it is a database transaction operation | Reuse the existing rollback-owned borrowed client; independently await app/filesystem/runtime owners |
| [node-postgres Pool API](https://node-postgres.com/apis/pool), current library documentation | Pool metrics describe total/idle/waiting clients; acquisitions use idle handoff or a queue, and clients require release | Retain original queued-checkout evidence and actual release; point snapshots and a later healthy probe do not establish the stalled caller's cause |
| [OWASP command injection defense](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html), informative guidance | Validate allowed commands/arguments and separate executable from data | Extend the existing strict CLI parser with fixed root dimensions; no shell-built commands or arbitrary scenario imports |

Host versions observed: Node 24.18.1 and npm 12.0.2. The package supports Node
>=24.15 <25. The versioned 24.20 reference is used only for established behavior;
newer test-tag APIs are not assumed available at the supported floor.

Separating a deterministic correctness case from an explicit full scaling
matrix is a project decision inferred from the measured work, not a W3C mandate.
The benchmark retains private projection and byte-work assertions; lower elapsed
time alone cannot justify dropping guards. One baseline-first comparison is
descriptive and order-sensitive. No browser behavior changes, accessibility
certification, image provenance attestation or whole-CI speed claim follows.

The complete-command failure prompted the additional Pool API lookup on the
same consultation date. Only established pool metrics/acquisition/release
semantics are used; newer options in current documentation are not assumed to
exist in the installed driver. No pool sizing change is inferred from one
queued-checkout snapshot. The original record has no observed driver-client
association, so its cause remains unknown despite a later passing diagnostic.
