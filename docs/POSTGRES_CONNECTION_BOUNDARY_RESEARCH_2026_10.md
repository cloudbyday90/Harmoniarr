# PostgreSQL connection boundary: official research

Consulted through MCP search, official navigation and repository metadata on
2026-10-13. Local versions inspected: Node 24.18.1, pg 8.23.0, pg-pool 3.14.0.
Documentation versions below do not claim those newer Node versions are deployed.

| Primary source / status | Applicable practice | Implementation / evidence |
| --- | --- | --- |
| [node-postgres Pool API](https://node-postgres.com/apis/pool), maintainer documentation | Pool is lazy; connect event signals established backend connection; counters describe admission; release acquired clients | Preserve lazy creation, original concrete clients and release callbacks; observe cold startup before public pool events |
| [node-postgres Client API](https://node-postgres.com/apis/client), maintainer documentation | Connection failures belong to connect promise/callback; idle errors have a different lifetime | Preserve original checkout error and existing idle error handling; no new error listener that swallows driver failures |
| [pg-pool installed provenance](https://api.github.com/repos/brianc/node-postgres/contents/packages/pg-pool/index.js?ref=544b1ce8152bc280e398dc1e8a66920abe6a640e), official source at package gitHead | Cold dispatch constructs its Client; queued promotion occurs separately; checkout and client startup timers can both participate | Restrict association to synchronous owned dispatch; no causal inference from generic timeout text |
| [pg Client installed provenance](https://api.github.com/repos/brianc/node-postgres/contents/packages/pg/lib/client.js?ref=df274d1ba9ad9d11a8f1079314faeafde7208207), official source at package gitHead | Transport/TLS creation leads to startup; protocol authentication and ReadyForQuery are separate stages | Version-checked fixture adapter records fixed milestones; no payload serialization |
| [pg protocol connection provenance](https://api.github.com/repos/brianc/node-postgres/contents/packages/pg/lib/connection.js?ref=df274d1ba9ad9d11a8f1079314faeafde7208207), official source at package gitHead | sslconnect occurs when the secure stream is created | Record TLS creation separately from Node secureConnect; neither means PostgreSQL readiness |
| [Node 24.20 TLS API](https://nodejs.org/download/release/v24.20.0/docs/api/tls.html), stable runtime documentation | secureConnect follows handshake completion; certificate authorization is separate | Fixed completed-handshake milestone only, no certificate/authentication claim |
| [Node 24.20 net API](https://nodejs.org/download/release/v24.20.0/docs/api/net.html), stable runtime documentation | Socket connect observes transport establishment, not PostgreSQL startup | Separate transport and backend readiness; synthetic handshake hold uses real pg driver |
| [Node 24.20 performance APIs](https://nodejs.org/download/release/v24.20.0/docs/api/perf_hooks.html), stable runtime documentation | performance.now supplies process-relative high-resolution time | Bounded monotonic offsets, invalid clock becomes null; no wall-clock or cross-process causality claim |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1 Working Draft | Monotonic durations avoid clock-adjustment ambiguity; timing has privacy implications | Use the principle with Node's implementation; this draft is not a Recommendation or a Node conformance certification |
| [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive data, bound logs and isolate logging failures | Scalar match result, opaque IDs and fixed stages only; hostile-field/sink controls; records precede independent failure probes |

The source-backed engineering inference is that the previous public counters and
healthy later probes cannot locate an original startup stall. Instrumenting the
owned client's actual startup adds evidence for a future recurrence; it does not
retroactively diagnose the retained failure. The adapter's exact version gate is
a project safeguard for internal API use, not a maintainer compatibility promise.

Recommendation: retain current limits, same-client transactions, full content
verification and production authority. Prefer a narrow fixture adapter over
global tracing or resource changes. Pros, cons and the implementation stack are
in the [design](POSTGRES_CONNECTION_BOUNDARY_DESIGN.md); executed outcomes belong
in the [separate outcome](POSTGRES_CONNECTION_BOUNDARY_OUTCOME.md).
