# Media inspection lifetime: official research

Consulted October 11, 2026 using MCP search, saved verified URLs and official
navigation. Local Node is 24.18.1 and npm 12.0.2; no later October publication is
assumed. The selected ownership architecture is a project inference from these
contracts and traced code, not a requirement imposed by a standards body.

| Official source / status | Applicable practice |
| --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html), language specification | Observe returned asynchronous completion; preserve original work failure through cleanup, including null. |
| [Node 24.18.1 child processes](https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html), runtime documentation | Process exit and closed stdio are different boundaries. Keep argv separate from shell commands and retain the existing command owner; test normal close propagation through inspection. |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html), runtime documentation | Timer cancellation is separate from admitted asynchronous renewal drainage. |
| [node-postgres pooling](https://node-postgres.com/features/pooling), driver guidance | Returned clients and pool shutdown have their own lifetimes. Drain known worker finalizers before fixture pool/environment/workspace disposal. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Diagnostic logging failure must not block ordinary workflow or leak sensitive information. Await returned Activity with existing best-effort outcomes; required audit remains a different owner. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Monotonic elapsed spans help measure observed boundaries. Node/PowerShell validation timings are project measurements, not browser or W3C conformance evidence. |

## Recommendation stack and tradeoffs

Reuse durable operation runs and captured lease authority, small ESM lifetime
factories, returned completion, best-effort advisory ownership, ordered renewal
and release, captured application owners and boundary-specific validation.
This avoids another singleton/subprocess layer and prevents known finalization
overlap. It costs cooperative shutdown latency and does not drain hidden work.
Broader forced cancellation needs its own process identity and provider policy
evidence; a cleared timer or extra sleep cannot establish that evidence.

No rendered control or HTTP mutation changes here, so new WCAG/ARIA browser checks
are not applicable. The existing web-standards skill retains its browser, HTTP
authority and uncertain-acceptance workflows for changes that touch those owners.
