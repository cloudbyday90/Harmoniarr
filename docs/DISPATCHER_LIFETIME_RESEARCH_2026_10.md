# Dispatcher lifetime research

Consulted October 11, 2026 through MCP search and official navigation. Exact host
timer documentation was reached from its reopened HTTP page's Timers link.
Raw responses stay in .tmp/dispatcher-lifetime-2026-10-11/.

| Official source | Applicable contract | Project boundary |
| --- | --- | --- |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html) | clearInterval cancels scheduled repetition | Independently own promises already admitted |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Promise capabilities and all-settled observation | Register before launch, drain siblings and retain failures |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html) | SKIP LOCKED is useful for queue consumers and provides an inconsistent general read | Keep authoritative durable claim SQL; an in-flight committed claim still needs handoff |
| [pg pooling](https://node-postgres.com/features/pooling) | Return clients; pool end waits for checked-out clients | Stop claim/handler resource use before pool teardown |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Exclude credentials and sensitive data | Fixed lifecycle refusals; existing bounded fixture diagnostics |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Monotonic measurement | Measure actual drains separately from residual sleep |

ECMAScript is a language specification; Node/pg/PostgreSQL are vendor contracts;
OWASP is informative security guidance. W3C's cited timing document remains a
September 1, 2026 Working Draft, not a stable Recommendation or UI conformance
claim. Actual runtime versions and executed evidence belong in the outcome.

The two-phase dispatcher drain is a project inference from these contracts and
the held-claim reproduction. Sources do not mandate our method names or prove a
historical bootstrap cause. Retain durable claims, authorization, lease fencing
and asynchronous dispatch. Cancellation acknowledgement, stopped timers and
queued acceptance do not certify native completion. Await returned completion
without automatically broadening the claim to legacy consumers or hidden I/O.
