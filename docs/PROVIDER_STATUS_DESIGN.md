# Provider status aggregation design

October 28, 2026. Follows the next [Apple UI item](APPLE_STATUS_UI_OUTCOME.md).
See [official research and tradeoffs](PROVIDER_STATUS_RESEARCH_2026_10.md) and
the separate [outcome](PROVIDER_STATUS_OUTCOME.md).

## Contract and scope

Add a narrow ESM provider-status-service factory. It captures only supported
reader functions keyed plex, spotify, youtube and appleMusic. Successful owner
payloads pass through unchanged. A failed non-database observation becomes:

```json
{"provider":"apple_music","availability":"unavailable","code":"provider_status_unavailable"}
```

Do not invent linked=false, configured=false or localSigning=invalid. Add
statusSummary with state complete, partial or unavailable and a deterministic
unavailableProviders list of response keys. All configured readers failing locally
can still produce a successfully collected HTTP 200 unavailable representation;
this is not a health or provider-acceptance claim.

The authenticated/no-store provider GET uses all four readers through module
composition. The administrator overview reuses the factory for its existing
Spotify/YouTube/Apple provider projection, forwarding its pool/queryable and
adding the summary there. includeDependencies=false keeps provider reads skipped.
Required settings payload, schema, dependency-health and other overview work
remain separate failure boundaries. Settings payloads, OAuth/Plex commands,
secret persistence, sessions and permissions do not change.

## Failure and lifetime

Recognize native database connection failures through the existing mapper, plus
already typed database_unavailable and bounded auth/session lookup-unavailable
errors. Those lookup owners wrap checkout/deadline/retirement failures; preserve
them conservatively as shared 503 database_unavailable. Never reflect raw message,
SQLSTATE, cause or secret values in an unavailable object or new request error.
Unexpected non-database reader errors are also explicit unavailable observations;
this protects sibling output but can make a reader bug a partial result.

With default independently owned reads, start at most four functions and await all
settled outcomes, including synchronous throws, before producing output or the
shared failure. Do not race, retry, cancel siblings or manufacture a timeout.
Returned-promise settlement does not itself establish native drainage. Existing
read owners retain their deadlines and cleanup responsibilities.

When a queryable is supplied, execute readers serially to avoid overlapping work
on one borrowed client. Continue past local failures, but stop admission at a
classified database failure after the current reader settles. Never acquire,
release, commit or roll back the caller's handle. Null payloads from optional
injected readers remain null, preserving existing construction contracts.

## Qualification

Focused tests cover per-reader success/failure, all unavailable, fixed privacy
projection, native/typed lookup classification, synchronous throw, held sibling
settlement, serialized borrowed reads and no retry. Route/module/overview checks
verify scope, composition and unchanged successful payloads. A guarded native
HTTP/PostgreSQL fixture corrupts only its disposable Apple ciphertext, observes
healthy siblings and recovery, exercises bounded injected peer failures and an
actual owned backend termination, and verifies auth/no-store/no-write behavior.
Update the existing Apple native corruption expectation to the new partial wire
contract and rerun that affected entry.

Freeze source for the full fast gate and fresh image. The separate
[Docker design](LOCAL_DOCKER_PROVIDER_STATUS_DESIGN.md) owns packaged comparison,
native/browser evidence and retained unrelated qualification. No new route,
database artifact, dependency, release or deployed app is required.
