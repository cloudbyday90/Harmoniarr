# Provider route error policy design

October 28, 2026. Implements the next [HTTP error item](HTTP_ERROR_OUTCOME.md).
See [official research and tradeoffs](PROVIDER_ROUTE_ERRORS_RESEARCH_2026_10.md),
the separate [outcome](PROVIDER_ROUTE_ERRORS_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_PROVIDER_ROUTE_ERRORS_DESIGN.md).

## Ownership and contract

Add a narrow ESM policy module next to existing provider integration policies.
Export separate MusicBrainz and Soulseek normalizers over private fixed catalogs.
Metadata uses the first; downloader, candidate and Soulseek adapters share the
second. Keep route authentication, CSRF, mutation policy and response envelopes.

MusicBrainz retains not-found 404, misconfigured/unavailable 503 and request-failed/
invalid-response 502 codes. Soulseek retains misconfigured/unauthorized/unavailable
503 and request-failed 502 codes. Text is fixed, with configuration/retry guidance
and no environment values, remote response, URL, SQL or key material. Reuse
existing bounded guidance and describe the user-facing service as Soulseek.

Read an existing immutable public descriptor first; otherwise inspect only code.
Require a primitive string and an own catalog key. Do not coerce keys, inspect
message/cause/body/details/headers or invoke serialization. A throwing code getter
leaves the original error for the guarded terminal handler. Known provider codes
always get catalog text, even if the source error is an API error. Preserve input
objects and unknown error identity; do not translate another provider's codes.

Local validation, not-found, conflict and auth errors now keep useful text only
when their application owner already created a public descriptor. Metadata must
stop recreating public local errors merely from an incoming code/message. An
unowned lookalike consequently receives the terminal generic 500. Existing real
local services were migrated to the shared factory in the preceding item.
Neither unknown codes nor arbitrary status/expose flags create public intent.

This policy does not change provider request retries, transport/native lifetime,
durable command acceptance, SQL transactions, stored diagnostics or internal logs.
Direct responses, redirects and other explicit public-error factories remain
separate projection owners; this is not a repository-wide disclosure audit.

## Observed refresh focus correction

The initial browser check reproduced loss of Refresh focus when Downloader's
native disabled flag changed during loading. The view now guards refreshQueue
with existing loading/revalidation/provider-disabled state. Pending requests use
aria-disabled while the native button stays focusable; a disabled provider still
uses native disabled. There is no scripted focus restoration. Hold initial and
revalidation reads to prove duplicate Enter/Space/click refusal, focus retention,
no stealing a later user focus move and the disabled-provider guard.

The reusable [browser scenario](../testing/browser/provider-route-error-scenario.js)
and [browser entry](../test/browser/provider-route-errors-browser-verification.test.js)
also cover fixed provider feedback and recovery. This adds one small view change,
without a new composable, style system or request owner.

## Qualification

Unit tests cover every catalog entry, public-descriptor precedence, unsafe message
getters, lookalike local errors, cross-provider/unknown codes, prototype/coercion
keys and identity preservation. Route fixtures use the actual terminal handler;
their intended local errors use the same factory as production services. Add
actual-app route/service injection to prove fixed output and local validation.

A guarded native fixture uses actual app authentication, CSRF and PostgreSQL,
with controlled service faults through existing composition. Exercise all four
adapter families, stable status/code, unknown/local lookalike refusal, actual
local validation, anonymous/current-role refusal and recovery. Compare settings,
secrets and relevant audit projections around reads/refusals; do not contact live
providers or issue actual download commands. Final packaging has no fixture routes.

After review/focused qualification, freeze source and run one full fast gate,
fresh image comparison and affected final native/browser checks. Retain unrelated
SQL/media/provider transport proof after exact source/test/runtime comparison.
Keep design, research and outcomes separate. Main only; no release/tag or PR merge.
