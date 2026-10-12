# External request discovery: official research

Reviewed October 12, 2026 through search-service MCP and GitHub MCP. Repository
discovery supplies GitHub URLs; metadata supplies the PR collection template.
MCP searches discovered current OWASP, node-postgres, IETF and slskd primary pages.
Previously verified W3C/TC39/Node URLs were reopened. Saved links are starting
points; returned page identity and contents establish consulted evidence.

## Applicable sources and decisions

| Primary source | Guidance / status | Project application |
| --- | --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Promise capabilities and arbitrary rejection reasons | Reuse shared completion ownership; retain original Error/null after cleanup |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html) | Callback time/order is not guaranteed | Await actual discovery completion beyond claim/tick completion; replace earlier status polling where the owner is known |
| [node-postgres pooling](https://node-postgres.com/features/pooling) | Release checked-out clients; end drains them and refuses later checkout | Drain admitted worker before pool disposal; pool end does not own later queries |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Server-side object/relationship checks, deny by default and safe failure handling | Retain request/intent/target guards on transaction-owned publication and sanitized worker errors |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | Automatic non-idempotent retry requires safe semantics or evidence of non-application | No new search POST replay introduced by close; explicit operator retry remains its own durable contract |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/) | September 1, 2026 Working Draft; monotonic elapsed time | Keep elapsed observations separate from operational timestamps and matched speedup claims |
| [Official slskd repository](https://github.com/slskd/slskd) | Primary project describes separate search, result and download capabilities | Trace the actual wired local API client; search ingestion is not download completion or a deployed-version compatibility proof |

These are project inferences from relevant sources, not standards mandating this
worker architecture. W3C timing is a draft, OWASP is defensive guidance, vendor
source describes its project, and TC39/IETF define language/HTTP semantics. No UI
changes or WCAG conformance claim apply to this slice.

## Source-traced security boundary and recommendation

The review owner validates target eligibility and writes approval intent/run/audit
transactionally. Discovery verifies intent/request relationship and rechecks
request state, recipient, target eligibility, maintenance and cancellation around
provider work. Candidate ingestion invokes that guard on its transaction client
after taking the request lock, then persists target-owned candidates/files.
Required ingestion audit is awaited. Existing sanitized worker diagnostics and
no-candidate/manual-retry outcomes remain distinct from escaped infrastructure
failures. These boundaries remain unchanged.

Select shared ESM completion plus lease drainage and ordered application owners.
Benefits are deterministic cleanup and observable escaped failures; cost is
cooperative waiting on admitted dependencies. Preserve actual authority and
provider transport contracts. Defer forced abort, search replay, changed
acquired-unavailable outcomes and global scheduling rewrites. Extend the existing
practical standards skill with concrete owners and adverse evidence. The
[design](EXTERNAL_REQUEST_DISCOVERY_LIFETIME_DESIGN.md) owns alternatives; the
separate outcome records executed versions, counts and limits.
