# Fixture HTTP phase official research

Consulted: 2026-10-16. URLs discovered through MCP search and official navigation;
installed host Node is 24.18.1. Apply only the stable Node 24 API contract.

| Official source and status | Applicable practice | Project decision |
| --- | --- | --- |
| [Node 24 async context](https://nodejs.org/download/release/v24.0.1/docs/api/async_context.html), runtime documentation | run preserves synchronous results/errors and scopes async descendants; enterWith can affect subsequent event handlers | Enter a fresh synchronous request scope; restore the caller context and explicitly retire descendants |
| [Node 24 HTTP](https://nodejs.org/download/release/v24.17.0/docs/api/http.html), runtime documentation | Server request dispatch and response finish/close are distinct lifecycle boundaries | Enter at server dispatch, retire on local response finish or close; do not infer remote receipt |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/), November 23, 2021 Recommendation | Correlation can expose information; header propagation needs explicit privacy/security boundaries | Keep this fixture correlation internal; do not inspect or propagate caller tracing headers or claim Trace Context conformance |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Record useful interaction context while excluding secrets and preserving behavior through logging failures | Reuse approved fixture UUID/phase records; omit request metadata and preserve original failures |

Explicit retirement of the inherited context is a project inference from Node's
async-descendant behavior: restoring the synchronous caller alone does not expire
already-created descendants. A phase at checkout admission records that boundary,
not the cause of a later failure or whole-application quiescence.

The adapter maintenance cost is justified by direct server attribution without
production middleware or new transport headers. Opening GitHub MCP discovery
found no open PRs, so random PR application is currently inapplicable.
