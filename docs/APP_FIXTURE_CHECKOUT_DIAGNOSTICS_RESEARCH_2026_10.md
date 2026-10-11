# App-fixture checkout: official research

Consulted October 11, 2026, America/New_York through MCP search/open/navigation.
URLs were returned by official search results/navigation, not constructed from
assumed paths. Raw responses live in
`.tmp/app-fixture-checkout-2026-10-11/official-mcp.json`.
Raw SHA256: `cb373ad6362c99fa105a4291cc053b2cff969a66693ca49027d395e44d55406f`.

| Source | Classification | Applicable practice |
| --- | --- | --- |
| [node-postgres pool API](https://node-postgres.com/apis/pool) | Vendor API documentation | Observe total/idle/waiting counters; preserve native checkout/release/end ownership |
| [PostgreSQL 18 error codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) | Vendor PostgreSQL 18.6 documentation | Prefer SQLSTATE codes over localized error prose |
| [Node 24 performance APIs](https://r2.nodejs.org/docs/latest-v24.x/api/perf_hooks.html) | Vendor documentation, opened v24.21.0 | Use `performance.now()` with its receiver for elapsed time |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Informative security guidance | Allowlist bounded fields, omit secrets and connection strings; logging failures do not take over operations |
| [W3C High Resolution Time Level 2](https://www.w3.org/TR/hr-time-2/) | Recommendation, November 21, 2019; reached through Node navigation | Use an elapsed clock that is not affected by wall-clock adjustment |

Host: Node 24.18.1, pg 8.23.0, pg-pool 3.14.0, Testcontainers PostgreSQL 12.1.0.
The opened latest-24 document is a different minor from the host; the used clock
API is verified locally. Current PostgreSQL documentation minor does not prove
the cached native test server's version. Read actual server version in validation.

Local pg-pool 3.14.0 source confirms that checkout queue timeout can produce an
Error with no code, while a new-client timeout can wrap a cause. Therefore expose
approved bounded cause chains and three counter snapshots; do not infer timeout
from arbitrary error messages. Its closing flags are version-specific source
observations, not independent shutdown proof. No driver internals are mutated.

The Node document also links W3C High Resolution Time. Its monotonic-duration
principle is applicable to measurements; it does not define pool authority or
failure recovery. This fixture-only slice changes no web interaction and makes
no new accessibility-conformance claim. Applicable frontend standards remain in
the maintained standards skill. Source consultation is not execution or a claim
that passing retries resolved the preceding failures.
The independently searched Level 3 document is a historical Working Group Note
whose features were merged into Level 2; it is not promoted as a newer
Recommendation. Status/navigation records are retained separately in
`.tmp/app-fixture-checkout-2026-10-11/official-w3c-mcp.json`.
Raw SHA256: `b8cab443774d16a092136431777f219bdb94391d322f9dfb0f250f240929763d`.
