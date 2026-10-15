# PostgreSQL startup guard official research

Consulted 2026-10-15 using MCP search/opening and GitHub repository metadata.
Links below were discovered through those services. Installed Node is 24.18.1,
npm 12.0.2 and Testcontainers 12.1.0; local Linux Docker Engine is 29.8.2.
PostgreSQL 18, existing pool limits and resource deadlines remain unchanged.

| Primary source and status | Applicable practice | Project decision |
| --- | --- | --- |
| [Testcontainers PostgreSQL module](https://node.testcontainers.org/modules/postgresql/), maintainer documentation | Connection configuration is obtained from the started container's host, port, database and credential accessors | Extend acknowledged ownership across metadata extraction; this project keeps explicit cleanup rather than adopting a new disposal API |
| [Testcontainers container lifecycle](https://node.testcontainers.org/features/containers/), maintainer documentation | A stop timeout waits for shutdown; container/volume removal and automatic cleanup have distinct settings | Retain the existing bounded awaited stop and reaper behavior; verify exact retirement independently in native tests |
| [ECMAScript 2026 statements](https://tc39.es/ecma262/2026/multipage/ecmascript-language-statements-and-declarations.html), versioned specification algorithms | Throw carries its expression value; abrupt cleanup can replace a prior completion unless caught | Catch synchronous and asynchronous stop failures while preserving the original Error/null setup outcome |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement dated 2025-05-15 | Minimize transferred personal data | Keep connection configuration and native identities private; report bounded stage/outcome evidence |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude credentials and database connection strings; verify diagnostic failure handling | Add no raw metadata logging; observer failure must not replace the setup failure |

This ownership guard and primary-failure policy are project engineering choices
inferred from the sources and local reproduction. W3C's Statement does not mandate
PostgreSQL fixture disposal, and no browser/WCAG or blanket security certification
is claimed. Current maintainer examples may use newer disposal syntax; this
change uses the installed runtime's established explicit async cleanup.

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Extend the existing guard around all post-start setup | Small review surface; retains one owner/deadline; fixes metadata failures without changing successful behavior | Failed startup must wait for its bounded stop attempt | Implement |
| Introduce another acquisition/disposal service | May suit future shared policy | Adds indirection and duplicates an existing small owner | Reject for this correction |
| Adopt automatic disposal syntax now | Can express lexical ownership | Broader lifecycle/API migration without need; public runtime still transfers ownership after startup | Defer |
| Retry stop or replace the original failure | May appear to recover or expose more errors | Changes bounded work or Error/null identity; does not establish shutdown | Reject |
| Clean up after any failed start without an acknowledged owner | Looks conservative | May invent authority over unknown/unreturned resources | Reject |

Recommended stack: acknowledged container → guarded metadata/evidence/schema
setup → one awaited bounded stop on failure → exact primary-value preservation
→ existing published runtime lifetime → independent native retirement proof.

See [design](POSTGRES_STARTUP_GUARD_DESIGN.md) and
[outcome](POSTGRES_STARTUP_GUARD_OUTCOME.md).
