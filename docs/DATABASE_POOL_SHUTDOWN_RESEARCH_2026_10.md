# Database pool shutdown research

Consulted October 11, 2026 through the connected search MCP. URLs were discovered
by searches and, for the host's HTTP API, by following the HTTP-close link in the
discovered Node 24.18.1 HTTPS page. Explicit discovered URLs were reopened when
cross-turn result IDs resolved to unrelated pages. Raw responses are retained in
`.tmp/app-pool-lifetime-2026-10-11/research-mcp.json`.

| Official source | Relevant guidance | Application / limit |
| --- | --- | --- |
| [pg pool API](https://node-postgres.com/apis/pool) | End drains clients and shuts down timers; counters describe pool activity | Await the concrete pool's end; do not manufacture replacement while waiting |
| [pg pooling](https://node-postgres.com/features/pooling) | Return checked-out clients; end waits for their return; checkouts after end error | A held native client supplies a controlled close barrier |
| [Node 24.18.1 HTTP](https://nodejs.org/download/release/v24.18.1/docs/api/http.html) | Server close controls connections; force-close also closes active HTTP connections | Infer no application promise drainage from socket closure; verify independently |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Exclude passwords, connection strings and other sensitive values | Fixed refusal code/message; no pool/config/error-prose serialization added |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Monotonic clocks support elapsed measurement; wall time is user-facing time | Existing diagnostics use elapsed measurements; no new browser API required |
| [ECMAScript 2026](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Promise.withResolvers supplies one promise and its resolving functions | Publish the shared close promise before calling native end, including synchronous reentrancy |

The W3C latest page identifies a September 1, 2026 Working Draft. This is a
measurement principle, not a claim of stable Recommendation status or browser
conformance for a server-only change. Node guidance matches the observed host
24.18.1; runtime support remains the repository's Node 24 range. The installed
pg and pg-pool implementation and native gate supply actual behavior evidence;
unversioned vendor guidance does not certify every installed implementation.

## Recommendations and tradeoffs

Use native end completion plus a synchronous application admission fence. This
is an architectural inference from the pg contract and the reproduced generation
race; the vendor does not prescribe this particular factory. Keep failure closed
rather than manufacture successful cleanup. The cost is explicit refusal for
shutdown-time callers and retained unavailable state after uncertain close.

Next, register actual worker completion before launch, close worker admission,
and await owned work before database/environment/workspace teardown. That should
replace the arbitrary fixture wait only after cancellation, failure and late
registration controls pass. An async-context fence can supplement ownership but
cannot substitute for draining captured clients, files or remote effects.

Final stack: pg native lifecycle; modular ESM factory; invocation-owned completion
gates; bounded OWASP-aligned diagnostics; Node HTTP ownership checks; W3C elapsed
measurement principles. Preserve dedicated native scenarios and serial isolation
before evaluating another test-scheduling optimization.

Source types: ECMAScript is a language specification; W3C's cited latest timing
document is a Working Draft; Node/pg pages are vendor API guidance; OWASP is
informative security guidance. Publishing a factory promise before end is a
project convention justified by the reentrancy control, not a standard mandate.
