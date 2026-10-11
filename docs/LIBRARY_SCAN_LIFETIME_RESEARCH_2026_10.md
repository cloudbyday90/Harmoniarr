# Library scan lifetime research

Consulted October 11, 2026 through connected MCP search and reopened official
pages. Exact host timer guidance uses the previously discovered official URL;
a saved link was reopened rather than treated as current evidence.

| Official source | Applicable contract | Project decision / limit |
| --- | --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Promise capabilities and settled-outcome observation | Register before launch, expose completion and retain exact failures |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html) | Timer cancellation controls future repetition | Independently drain admitted lease renewal |
| [pg pooling](https://node-postgres.com/features/pooling) | Return clients; pool shutdown waits for active clients | Await worker SQL/finalizers before ending its pool |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Exclude secrets and sensitive data | Fixed refusals and existing approved fixture diagnostics; no new raw dumps |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Monotonic elapsed measurements | Existing phase observer measures actual drain; domain timestamps retain their meaning |

ECMAScript is a language specification; Node/pg are vendor guidance; OWASP is
informative security guidance. The W3C source is a September 1, 2026 Working Draft,
not a stable Recommendation or a new UI conformance claim. Actual versions and
executed scope belong in the separate outcome.

Producer-before-consumer drainage and the shared cleanup helper are project
inferences from these contracts and the controlled reproductions. Sources do
not mandate method names or prove historical bootstrap/authority causes.
Queued acceptance, persisted terminal status, stopped timers and observed
release callbacks are earlier boundaries than full returned execution.
