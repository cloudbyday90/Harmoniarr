# Fanart.tv response containment design

## Decision and ownership

Adopt the existing 2,000,000-decoded-byte JSON-object reader for Fanart.tv's
artist/album metadata requests. This is a project budget, not a vendor maximum.
Keep origin admission, request paths, credential resolution and image selection
in the client. Move attempts, body handling, Retry-After/backoff and approved
failures into a narrow ESM request-service factory.

Preserve header-only `api-key`/`client-key`, redirect refusal, transport/429/5xx
retries, jitter and 404-to-empty behavior. Resolve credentials once per logical
request as before. If resolution fails, expose a generic failure without retaining
the resolver's native exception or secret. Reject invalid retry counts rather
than silently perform no request or fall through on NaN/fractional values.
Ordinary finite retry counts remain capped at the existing maximum of ten.
Timeouts must fit the native timer range. A Retry-After outside that range stops
automatic retries with a typed unavailable result, rather than letting Node turn
an overflowing timer into an immediate retry. Ordinary seconds and HTTP dates
remain supported; invalid values fall back to backoff.

Use one per-attempt deadline through headers and body. Oversized, malformed,
invalid-UTF-8 and non-object successful bodies are terminal typed failures with
no additional retries. Cancel ignored HTTP bodies before backoff, empty 404
publication or terminal HTTP classification. Cleanup failure preserves the known
status. Retain approved diagnostic codes and numeric attempt/status/retry fields;
exclude request URLs, headers, body text, native causes and rejected config values.

This bounds metadata input, not image downloads, total heap or aggregate client
concurrency. The artwork service's image download path needs separate review.
Research also identified a v3.2 album-envelope mismatch: current selection reads
top-level albumcover while the vendor describes nested albums. Preserve current
selection here and qualify target-bound album normalization as the next item;
flat synthetic album fixtures establish compatibility, not live v3.2 correctness.
Source tracing also found the default artwork module does not inject the existing
provider credential resolvers; its client defaults return null keys. Wiring that
application path takes priority in the next round. Current native credential
proof uses injected synthetic resolvers and does not establish saved-key delivery.

## Alternatives and recommendation stack

| Option | Benefits | Costs / decision |
| --- | --- | --- |
| Shared reader + provider request factory | Reuses UTF-8/byte accounting; explicit body owner; protects credential diagnostics | Fixed cap and a small maintained service. Recommended |
| Provider-only parser | Independent tuning | Duplicates reviewed parsing/cancellation. Reject |
| response.json() plus downstream redaction | Small patch | Leaves unbounded materialization and ignored bodies. Reject |
| Change every artwork transport and selector together | Broad coverage | Mixes JSON, image bytes and owner identity contracts. Defer to separate work |

Keep Node 24.22.1/npm 12.0.2, built-in fetch/default TLS, explicit origins and
redirect refusal, modular ESM factories, existing artwork services/PostgreSQL and
pinned Docker images. No repository npm dependency, schema, UI, version, branch or release change.

## Evidence plan

Prove exact decoded ceiling/overflow, UTF-8 accounting, declared/chunked lengths,
terminal successful-body errors, credential resolution failures, retry policy and
awaited ignored-body cleanup. Exercise the actual artwork consumer to distinguish
failed metadata from empty 404 results and prevent download/ingestion after refusal.
Reuse the owned native HTTPS fixture with the default Fanart.tv DNS/Host/SNI and
child-local trust/proxy state. Verify decompressed limits, body deadlines and
socket retirement before a later healthy response while the child remains alive.
Stubbed sleeps prove delay selection/order, not actual elapsed provider pacing.

Run owning/consumer checks before one stable fast gate, isolated Linux transport
qualification and a preserved-state no-cache Compose rebuild. See
[official research](FANART_RESPONSE_RESEARCH_2026_10.md) and
[outcome](FANART_RESPONSE_OUTCOME.md).
