# PostgreSQL startup cancellation official research

Consulted 2026-10-15 via MCP search/opening, including the Node version selector,
and GitHub repository metadata. Host Node is 24.18.1, npm 12.0.2, Testcontainers
12.1.0 and PostgreSQL 18; no dependency or resource-bound change is selected.

| Primary source and status | Applicable practice | Decision |
| --- | --- | --- |
| [WHATWG DOM](https://dom.spec.whatwg.org/), Living Standard updated 2026-10-15 | AbortSignal carries an arbitrary reason; checkpoints can observe cancellation around operations that do not accept signals | Recheck after acknowledged acquisition and immediately before publication; preserve Error/null |
| [Node 24 globals](https://nodejs.org/docs/latest-v24.x/api/globals.html), maintainer documentation opened at 24.22.0 | AbortController notifies participating APIs; aborted/reason expose cancellation | Use existing compatible signal checks on installed 24.18.1; notification alone is not proof of stopped I/O |
| [Testcontainers lifecycle](https://node.testcontainers.org/features/containers/), maintainer documentation | Supplying a stop timeout waits for shutdown; automatic cleanup and explicit stop are separate | Await actual acquisition and one bounded owned stop; keep reaper settings unchanged |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement dated 2025-05-15 | Minimize transferred personal data | Keep private runtime/connection identities and cancellation payloads out of public evidence |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude credentials/connection strings and test logging failure behavior | Add no raw payload logging; diagnostic or cleanup fallout cannot replace primary failure |

The checkpoint placement, cleanup transfer and actual-failure precedence are
project choices inferred from these sources and local reproduction. DOM does not
implement cancellation inside Testcontainers. W3C's Statement is not a fixture
disposal requirement or a WCAG conformance claim. Guidance remains scoped to
the installed ESM architecture rather than copying newer disposal syntax.

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Guard acquisition and final publication with existing owners | Small change; deterministic cleanup authority; both schema/source paths share policy | Cancellation waits for real start/preparation and bounded release | Implement |
| Race signal against start/preparation | Earlier caller rejection | Work can outlive caller without returned ownership; lost template/server cleanup | Reject |
| Add persistent abort disposal listeners | Could dispose a published owner automatically | Changes runtime ownership and can race admitted scenarios; listener lifecycle needs separate design | Defer |
| Replace actual setup failure with abort or cleanup error | Surfaces the latest event | Loses original Error/null and failure stage | Reject |
| Create another general lifecycle framework | Potential cross-owner reuse | Duplicates existing runtime/template lifetime and expands review surface | Reject for this slice |

Recommended stack: cooperative AbortSignal checkpoints → acknowledged owner →
single runtime publication guard → canonical template/server cleanup → exact
primary value → minimal diagnostics → focused contracts plus native proof.

GitHub MCP returned an empty open-PR collection at the opening check. There is no
applicable random PR to implement, merge, close or rebase; refresh before commit.

See [design](POSTGRES_STARTUP_CANCELLATION_DESIGN.md) and
[outcome](POSTGRES_STARTUP_CANCELLATION_OUTCOME.md).
