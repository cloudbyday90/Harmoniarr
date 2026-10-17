# PostgreSQL startup write official research

Consulted: 2026-10-16 through MCP source discovery and official navigation.
Installed host: Node 24.18.1, pg 8.23.0, pg-pool 3.14.0. Node 24 documentation is
applied only to stable socket/stream APIs; no later-version API is assumed.

| Source and status | Applicable practice | Implementation decision |
| --- | --- | --- |
| [Node 24 net](https://nodejs.org/download/release/v24.21.0/docs/api/net.html), runtime documentation | Write return/backpressure and callback progress describe different boundaries | Keep returned value and callback outcome separate. Local completion is not PostgreSQL receipt (project inference) |
| [Node 24 Writable](https://nodejs.org/download/release/v24.20.0/docs/api/stream.html), runtime documentation | Write callbacks can report errors separately from error events | Prove native error emission remains intact, and preserve failed/late callback evidence without changing driver failure |
| [PostgreSQL 18 message formats](https://www.postgresql.org/docs/18/protocol-message-formats.html), protocol documentation | StartupMessage, AuthenticationOk and ReadyForQuery have distinct meanings | Keep existing authentication/readiness markers; no local-write marker promotes server evidence |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Use monotonic elapsed measurements within their clock domain | Use bounded offsets from the owned checkout; do not compare client offsets directly to server log clocks or claim W3C conformance |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive data and preserve operation behavior when logging fails | Never inspect/serialize startup bytes or auth/query traffic; emit only bounded approved fields and preserve original failures |

Installed pg/lib/connection.js was reviewed directly: startup serializes once and
calls its stream.write with one Buffer and no callback. The source review, native
driver version guard and stream-method checks jointly bound the adapter; a
custom method or future driver version must not inherit that assumption.

The final stack is owned version-reviewed observation, explicit unknown states,
unchanged resource limits and native hold/success controls. Better local
attribution costs adapter maintenance; it does not establish the cause of the
historical startup stall. Opening GitHub MCP repository/PR discovery returned
zero open PRs, making random local PR application or stale-PR cleanup inapplicable.
