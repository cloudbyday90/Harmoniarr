# Import execution lifetime: official research

Consulted October 11, 2026 through MCP search/navigation. Research date is within
the requested October 2026 window; it does not anticipate later publications.
Local runtime is Node 24.18.1 and npm 12.0.2. These sources support the selected
boundaries; the ownership design remains a project inference.

| Official source / status | Applicable practice and project decision |
| --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html), language specification | Promise settlement represents returned work. Preserve original work rejection through cleanup and explicitly observe queued execution. |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html), runtime documentation | Cancelling a scheduled timer is a separate boundary from awaiting already admitted asynchronous renewal work; use the existing heartbeat drain. |
| [node-postgres pooling](https://node-postgres.com/features/pooling), driver guidance | Release checked-out clients and await pool shutdown. Keep worker finalizers ahead of fixture pool/environment disposal; do not create replacement pools to hide unfinished work. |
| [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html), Internet Standard | Section 9.2.2 constrains automatic retry of non-idempotent requests. Preserve saved handoff and uncertain acceptance; completion drainage grants no new POST/retry permission. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Diagnostic logging failure must not stop ordinary application behavior or leak information. Returned Activity work is drained with existing best-effort policy; required transactional audit is a different owner. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Use monotonic durations for measurements and label the source as draft. Node/PowerShell validation timings are project measurements, not browser or W3C conformance proof. |

## Recommended stack

1. Existing durable operation runs and guarded provider handoff: preserve authority,
   saved consent, dispatch evidence and confirmation behavior.
2. Shared ESM completion/coalescing owner with explicit terminal closure.
3. Returned advisory ownership and renewal-before-release finalization.
4. Captured application owners and signal-bound fixture execution completion.
5. Gated focused tests, affected real-PostgreSQL coverage and complete fast gate.

This stack limits code duplication and prevents known cleanup overlap. Its cost is
waiting for actual dependencies; a hung provider needs a separate bounded request
policy that also preserves uncertain acceptance. Expanding sleep or blindly retrying
POSTs cannot replace that policy. No frontend changes occur here, so WCAG/ARIA
testing is not applicable to this slice. The reusable standards skill retains its
existing browser workflows for actual UI work.
