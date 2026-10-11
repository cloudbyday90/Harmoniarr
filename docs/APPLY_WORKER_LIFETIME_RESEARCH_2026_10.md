# Apply worker lifetime research

Consulted October 11, 2026 using connected MCP search and GitHub metadata.
Vendor/specification URLs were discovered through search or existing verified
ledgers and reopened. The exact host HTTP page was reached through its discovered
HTTPS page's HTTP-close link. Raw responses are retained in
`.tmp/apply-worker-lifetime-2026-10-11/research-mcp.json`.

| Primary source | Applicable practice | Project boundary / limit |
| --- | --- | --- |
| [ECMAScript 2026 promise specification](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Promise capabilities permit registration before launch; all-settled semantics wait for every outcome | Observe every task and retain failures separately; a rejection is not evidence that sibling tasks stopped |
| [Node 24.18.1 HTTP](https://nodejs.org/download/release/v24.18.1/docs/api/http.html) | Server closure controls sockets | Await actual application work independently after HTTP closure |
| [pg pooling](https://node-postgres.com/features/pooling) | Return clients; native end waits for their return | Worker SQL and lease finalizers finish before pool closure |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Exclude secrets and sensitive connection data | Fixed admission refusal and approved phase labels; no new input/error dumps |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Use monotonic elapsed measurements | Existing phase observer measures actual worker drain separately from residual sleep |

ECMAScript is a language specification; Node/pg are vendor API guidance; OWASP
is informative security guidance. The cited latest W3C timing document is a
September 1, 2026 Working Draft, not a stable Recommendation or a new browser
conformance claim. This backend slice introduces no UI accessibility behavior.
Actual installed runtime versions and native evidence belong in the outcome.

## Architectural inference and tradeoffs

A per-worker completion owner is a project choice inferred from these contracts
and the held-release reproduction. None of these sources mandates our method
names. Preserve asynchronous queue acceptance and durable policy/lease fencing.
Close admission before drainage and await all captured work even after failure;
otherwise an early rejection can allow teardown under a sibling task.

The benefit is observed cleanup and prevention of duplicate execution during
final release. The costs are shutdown waiting for cooperative completion and an
explicit terminal lifetime for each worker instance. Do not convert timeout,
cancellation acknowledgement, terminal database status or stopped timers into
proof that native work stopped. Keep cancellation policy and remaining worker
ownership as separate follow-up rather than removing the fixture wait globally.

Final recommendation stack: durable operations and leases; modular ESM completion
and admission; actual renewal/finalizer drainage; application-owned teardown;
native pg lifecycle; bounded OWASP-aligned diagnostics and W3C/Node elapsed
measurement; focused gates followed by a stable full serial gate.
