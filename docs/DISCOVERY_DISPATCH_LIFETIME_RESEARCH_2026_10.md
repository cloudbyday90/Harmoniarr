# Discovery dispatch lifetime: official research

Consulted October 11, 2026 through MCP and previously verified primary URLs.
Local Node is 24.18.1 and npm 12.0.2. This is evidence within the requested October
window, not an assumption about later publications. Ownership and ordered cleanup
choices are project inferences from source and these contracts.

| Official source / status | Applicable practice |
| --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html), language specification | Observe returned work and preserve original failures through cleanup, including null. |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html), runtime documentation | Timer cancellation is distinct from admitted asynchronous renewal drainage. |
| [node-postgres pooling](https://node-postgres.com/features/pooling), driver guidance | Release checked-out clients and await pool shutdown. Known worker release/pruning precedes pool/environment/workspace disposal. |
| [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html), Internet Standard | Section 9.2.2 constrains automatic retry of non-idempotent requests. Closure grants no new retry/cancellation authority after unknown provider acceptance. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Monotonic spans measure observed boundaries; native timings are not browser conformance or matched whole-suite performance evidence. |

## Recommendation and tradeoffs

Keep durable operation/lease and saved-consent guards, modular ESM completion,
awaited provider/producer handoffs, renewal-before-release cleanup, original ledger
eligibility, captured ordered application owners and native resource validation.
Benefit: prevents known duplicate admission and teardown during finalization.
Cost: cooperative closure waits for actual dependencies, and hidden/remote provider
work still needs its own contract. Terminal status and fixed delays cannot replace
actual local completion.

Preserve existing bounded error presentation and diagnostic fields; fixed null
fallbacks add no private provider inputs. No UI/HTTP mutation changes occur here,
so new WCAG/ARIA browser checks are not applicable. Existing standards-skill
browser and authorization workflows remain available for those changes.
