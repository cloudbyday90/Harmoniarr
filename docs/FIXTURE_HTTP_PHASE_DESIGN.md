# Fixture HTTP request phase design

Date: 2026-10-16. Follow-up to the
[startup write outcome](POSTGRES_STARTUP_WRITE_OUTCOME.md).

The fixture's client-side scenario context does not establish the server handler's
async context. A failed application-pool checkout can therefore have an unknown
phase even while the client awaits an HTTP response. Bind the approved
`http_request` phase at the owned server's native request dispatch.

## Ownership and implementation

Extend the existing phase observer with private, explicitly retired scopes.
Only observers created by the existing factory can create those scopes. Use
AsyncLocalStorage.run synchronously, preserving the dispatch receiver, arguments,
return value and original Error/null. Nested measurements inherit the active
scope; nested and concurrent requests have independent lifetimes. Scope expiry
makes inherited late work unknown, without falling back to another active request.
Timing-disabled observers still carry context without reading clocks or sinks.

A focused adapter decorates only the owned native HTTP server's emit method for
its lifetime, plus each admitted request/response emitter until completion.
Dispatch only the server's request event through a fresh scope. Bind body and
response callbacks to that same scope because those events can otherwise run in
the transport context. Other server events and receivers keep their original
behavior. Register owned response
finish/close listeners before dispatch, retire the scope and remove those listeners
on completion, synchronous dispatch failure or fixture restoration. Preserve
request-listener order and once semantics, and restore the original descriptor
without overwriting a later owner. Custom dispatch methods remain uninstrumented.

The existing withServer helper composes that adapter and always retires it after
the shutdown attempt, preserving the first scenario/close failure. Both app
entrypoints already pass their owning phase observer. Existing route, session,
CSRF, schema, driver, pool size, timeout and scheduling policy remain unchanged.
Checkout records retain version three with one additional approved phase value.

No header, URL, method, payload, cookie or address is needed for attribution.
Existing fixture UUIDs identify the scenario, not a unique HTTP trace. This is
internal diagnostic context, not W3C Trace Context propagation or authentication.
An observed phase locates checkout admission; it does not diagnose a timeout or
establish completion of detached application work.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Client-side scenario measurement alone | Existing minimal code | Does not cross the HTTP server boundary | Retain for client work only |
| Owned server request scope with explicit retirement | Covers existing handlers and preserves listener behavior; bounded lifetime | Requires owned method/listener restoration and native controls | Implement |
| Add Express middleware to production startup | Familiar framework boundary | Changes application composition for a fixture-only need; misses native server fixtures | Defer |
| Global context or enterWith in one listener | Small initial patch | Can contaminate later listeners and unrelated work | Reject |
| Carry phase labels in request headers | Can cross processes | Adds untrusted input, privacy and protocol work unnecessary for this fixture | Reject |

Recommended stack: existing scenario observer, owned native request scope,
approved checkout projection, adverse lifecycle controls, then a fresh complete
integration investigation. Keep historical failures separate and use fresh phase
evidence before capacity or scheduling changes. See
[official research](FIXTURE_HTTP_PHASE_RESEARCH_2026_10.md) and the
[outcome](FIXTURE_HTTP_PHASE_OUTCOME.md).
