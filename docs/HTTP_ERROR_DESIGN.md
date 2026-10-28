# HTTP error response design

October 28, 2026. Implements the next [provider-status recommendation](PROVIDER_STATUS_OUTCOME.md).
See [research and tradeoffs](HTTP_ERROR_RESEARCH_2026_10.md), the separate
[outcome](HTTP_ERROR_OUTCOME.md) and [Docker design](LOCAL_DOCKER_HTTP_ERROR_DESIGN.md).

## Explicit public intent

Keep createApiError's Error return and its existing mutable status/code/message
properties for internal consumers. Capture only the supplied primitive public
fields in an immutable descriptor held in a private WeakMap. A copied object,
prototype, symbol or expose/status flag cannot acquire that descriptor. Later
error-property mutation must not change the captured response. Weak ownership
must not retain otherwise unreachable errors.

Admit integer HTTP statuses 400–599, nonempty string codes up to 128 UTF-16 code
units and nonempty string messages up to 2,048 code units. Invalid descriptors
have no public intent and follow the same normalization/fallback path as unknown
errors. Application error
constructors explicitly choose public text; this boundary does not sanitize
arbitrarily unsafe wording intentionally supplied to that factory. Preserve
existing useful field validation and intentional 4xx/5xx contracts.

An AST-assisted source inventory initially finds 713 API/HTTP/bootstrap factory
calls and older status-bearing constructors across 24 additional files. Review
their existing text/status/code, migrate those constructors to createApiError,
and retain their normalization, throw/return and internal field semantics. This
inventory is a source aid, not proof of complete runtime reachability.

## Projection and response ownership

A narrow ESM projector first looks up captured intent. Otherwise the existing
parser adapter translates malformed/oversized JSON to fixed 400/413 errors, and
the existing database mapper translates recognized connection failure to fixed
503 database_unavailable. No general trust in status/code/message/expose from
unknown objects. If normalization itself throws, use the generic fallback.

Unexpected errors, primitive rejections, invalid definitions and structurally
similar objects return status 500 and the existing envelope:

```json
{"ok":false,"error":{"code":"internal_error","message":"Unexpected server error"}}
```

Serialize only selected primitive fields. Never invoke an error's toJSON, traverse
cause or return stack/body/query/path/headers properties. Do not change the error
object, retry work, store diagnostics or add raw console logging. Route-local
normalizers, direct responses, redirects and intentionally public factory text
remain separate owners; this does not certify every possible response path.

Terminal Express middleware retains its four-argument signature and placement.
Before headers start, set no-store and send the bounded projection. After headers
start, do not set status/headers or append a JSON body; delegate a new bounded Error
with the selected public fields and no original cause to Express's existing
connection-failure handling. Existing upstream error diagnostics are unchanged.

## Qualification

Unit tests prove factory provenance, immutable capture, bounds, primitive and
hostile property/serialization controls, parser/database normalization and
already-sent response behavior. Actual application HTTP tests inject failures
through existing route/service composition and verify exact generic output,
intentional validation/auth/conflict/service contracts and parser admission.
Guarded native tests add real PostgreSQL connectivity, settings rejection without
writes, bootstrap/auth/CSRF behavior and exact cleanup. Preserve useful UI retry
feedback with controlled generic failures; do not write operator settings.

Run one frozen-source fast gate and fresh image comparison. Keep the final native
entry separate from overlay preflight; retain unrelated worker/media/database
proof only after exact source/test/runtime review. No schema or deployed app is
added, and no release/tag or PR merge is performed.
