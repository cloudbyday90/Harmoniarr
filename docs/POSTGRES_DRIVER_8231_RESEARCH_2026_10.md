# PostgreSQL dependency recommendations, October 2026

Consulted 2026-10-19 through GitHub MCP and MCP web search/open. Repository and PR
URLs came from GitHub search/metadata; upstream links came from PR release
metadata and official search results. Registry package versions, integrity and
gitHead metadata were checked locally against the installed lock. No invented
release notes or certification claims are used.

## Sources and applicability

The [official Pool API](https://node-postgres.com/apis/pool) documents FIFO waiting,
idle handoff, checkout timeouts and required release. This is public API guidance;
it does not promise private PendingItem identities or adapter compatibility.

The [immutable upstream comparison](https://github.com/brianc/node-postgres/compare/df274d1ba9ad9d11a8f1079314faeafde7208207...0980cefebe0ae461da8883703be049fe13ca96cf)
and published packages establish the actual changes. The
[maintainer changelog](https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md)
explicitly omits break-fix releases, so its lack of an 8.23.1 section is not
evidence of an empty patch. The comparison includes query-config copying,
pipeline/Sync handling, IP TLS host verification and Bind writer changes. Source
inspection is necessary alongside public documentation for internal adapters.

The [W3C High Resolution Time draft](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/)
is a Working Draft dated September 1, 2026, rather than a Recommendation.
Its distinction between monotonic measurement and wall-clock dates informs
elapsed diagnostics. [Node 24 performance documentation](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html)
provides the runtime API guidance. Local execution used Node 24.18.1; documentation
version is not the deployed runtime. Keep process-relative durations and avoid
subtracting clocks across processes. This does not claim browser conformance.

The [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
is informative security guidance. Apply bounded field selection and log-failure
isolation to existing diagnostic builders; preserve endpoint/credential/query
exclusion. Private raw test output remains ignored. No extra production logging
or telemetry service is necessary for this dependency review.

Microsoft's [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
states that 7.0 does not ship the old programmatic API, describes a TypeScript 6
compatibility package and identifies ecosystem integration limitations. This is
vendor migration guidance. Together with the actual local language-server
failure, it supports deferring random PR 48's direct replacement. It does not
establish failure of every build tool or a security vulnerability.

## Alternatives

| Recommendation | Pros | Cons / limits |
| --- | --- | --- |
| Retain all current dependencies | Smallest immediate change; already reviewed tuple | Defers upstream query and TLS fixes; leaves the known upgrade gate unresolved |
| Adopt pg and its required subtree after review | Focused runtime change; retains queue ownership and gains upstream fixes | Private adapters need exact version maintenance; selected native coverage is bounded |
| Adopt the entire PR 46 group now | Qualifies four updates in one change | Adds Express and browser/router surfaces unrelated to the driver; requires wider qualification |
| Remove all private adapters | Lower long-term coupling to driver internals | Loses exact queued-caller and startup diagnostic evidence; public events do not replace it |
| Replace TypeScript directly with 7.0.2 | Native compiler available | Installed language-server initialization fails; migration needs explicit tooling compatibility |

Recommended stack, in order: retain the existing Node 24 ESM/Vue/Express
architecture; adopt only the reviewed pg subtree; retain modular exact-version
diagnostic adapters with native adverse controls; use monotonic bounded records;
validate focused behavior, affected native owners and then fast checks; preserve
TypeScript 6 until an explicit tooling migration works. W3C, Node, maintainer
contracts and OWASP each inform a different boundary, without adding a generic
compliance checklist or declaring the whole system secure.

The next high-value follow-up is native PostgreSQL TLS identity validation:
controlled trusted certificates, matching and mismatching IP/DNS identities,
actual secureConnect versus sslconnect milestones, and retirement after handshake
failure. Keep certificate verification enabled. Then qualify the remaining
Express/Vue/router updates in PR 46 on their actual request/navigation boundaries.
