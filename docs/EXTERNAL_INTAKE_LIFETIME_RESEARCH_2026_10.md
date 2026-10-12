# External intake planning: official research

Reviewed October 11, 2026 using search-service MCP and GitHub MCP. Repository
discovery supplies GitHub URLs. MCP searches supplied node-postgres, OWASP and
WHATWG results; the WHATWG repository link supplies the canonical URL Standard,
and the W3C cover-page link supplies High Resolution Time. Previously verified
TC39, Node and IETF URLs were reopened through MCP. No guessed URL is evidence.

## Sources and project application

| Primary source | Guidance / status | Project decision |
| --- | --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Promise capabilities and arbitrary rejection reasons | Reuse completion owner; preserve Error/null identity through cleanup |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html) | Callback time/order is not guaranteed | Replace planner's fixed unit sleeps with actual execution completion |
| [node-postgres pooling](https://node-postgres.com/features/pooling) | Release checked-out clients; end waits for those clients and refuses later checkout | Drain admitted planner before pool disposal; pool drain alone does not own future queries |
| [WHATWG URL Standard](https://url.spec.whatwg.org/) | Living Standard defining URL parsing/API | Keep native URL parser, exact provider-host policy and reconstructed descriptors at existing owner |
| [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Trusted destination allowlists; redirects and connection-time destination policy matter | Trace actual outbound clients before changing their network policy; planner parsing is not complete SSRF proof |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | Automatic retry of non-idempotent requests requires evidence of safe semantics/non-application | No automatic provider POST replay added by lifecycle cleanup |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/) | September 1, 2026 Working Draft; monotonic time avoids clock adjustments | Keep operational timestamps separate from elapsed gate measurements; no matched speedup inference |

These are project inferences from applicable sources, not standards prescribing
Harmoniarr's worker architecture. No UI behavior changes, so this slice does not
claim WCAG conformance. W3C complements WHATWG parsing, IETF HTTP semantics, TC39
promise semantics, OWASP defensive practice and runtime/database documentation.

## Security boundary and final recommendation

The active-request service verifies existence, external_url kind/source and
needs_fetch state. Planning reloads that request and renormalizes its stored URL;
the queue service checks maintenance and active request before creating execution.
The worker forwards the plan's normalized descriptor rather than trusting launch
metadata as a new network destination. Provider clients operate in the separate
execution service. Preserve those boundaries and cancellation gates this round.

Select shared ESM completion plus renewal/release cleanup: deterministic local
ownership and fewer guessed waits, at the cost of waiting on admitted callbacks.
Keep durable queue and guarded writes ahead of status reporting. Defer forced
abort, arbitrary-URL support, transport retry and broad client hardening until the
actual executor/transport policy is traced. Extend the existing standards skill's
evidence map instead of creating an overlapping broad checklist. The
[design](EXTERNAL_INTAKE_LIFETIME_DESIGN.md) owns alternatives; the outcome will
record executed evidence, versions and limits separately.
