# Operator artist reconciliation: official research

Reviewed October 12, 2026 through search-service and GitHub MCP. Searches identified
the primary pages below; official node-postgres navigation supplied transactions.
Pages were opened and relevant sections read. Repository search supplied its URL;
repository metadata supplied the paginated open PR collection. No guessed links.

Observed installed versions: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0
and @testcontainers/postgresql 12.1.0. Runtime-specific advice uses the observed
Node documentation version, not an inferred latest release.

## Applicable practices

| Source | Status and relevant contract | Application / tradeoff |
| --- | --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Normative language specification: allSettled awaits every input; rejection reasons can be arbitrary values | Preserve first observed Error/null after all returned reads drain, retaining concurrent ordered results |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html) | Installed-runtime documentation; callback timing is not a completion contract | Keep queued acknowledgement distinct from real worker completion; use owned gates rather than guessed waits |
| [node-postgres pooling](https://node-postgres.com/features/pooling) | Driver guidance: return checked-out clients; pool end waits for their return and refuses later checkout | Own future worker queries before pool end; pool disposal alone cannot own a service |
| [node-postgres transactions](https://node-postgres.com/features/transactions) | Driver guidance: transaction statements must share one client | Preserve sequential per-release request/event transaction and existing advisory lock; parallel read helper is not a transaction scheduler |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Defensive guidance: least privilege, server-side relationship checks and authorization tests | Retain scoped snapshot lookup; distinguish lifecycle ownership from mutation-time current-policy and lease authority |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/) | September 1, 2026 Working Draft; elapsed measurement and clock concepts | Use observed elapsed duration, separate it from operational timestamps; no matched speedup or W3C conformance claim |

This architecture is a project inference from applicable contracts, not a W3C
mandate. This backend-only change does not establish WCAG conformance. No HTTP
method, replay, remote-provider contract or route authorization is changed.

## Final recommendation

Adopt shared ESM completion/lease drainage and a narrow returned-task batch owner.
Preserve concurrency, accepted IDs, snapshot checks, cancellation and existing
request/audit transactions. Benefit: actual known work finishes before fixture
or startup teardown. Cost: rejection waits for sibling work; uncooperative or
hidden detached dependencies need their own completion/abort contract.

Defer forced cancellation and comprehensive current-policy/lease fencing to their
own design and native adverse tests. A captured user/snapshot ID and successful
worker completion alone confer no publication authority. The
[design](OPERATOR_ARTIST_RECONCILIATION_LIFETIME_DESIGN.md) compares alternatives;
the outcome will record executed evidence and versions. Maintain the existing
practical standards skill with this distinction and concrete owners.
