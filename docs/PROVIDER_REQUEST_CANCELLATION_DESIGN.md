# Provider Request Cancellation Design

## Decision

Harmoniarr now uses a shared ESM cancellation utility at the provider-client
boundary. It is used by the MusicBrainz, ListenBrainz, and Last.fm clients for
the bounded Artist Detail related-artists workflow. The utility composes the
service-owned operation deadline with each provider client's existing request
timeout; neither value is controlled by a browser request.

This keeps cancellation behavior identical across providers without creating a
large cross-provider singleton. Provider-specific URL allowlists, HTTPS-only
base URLs, redirect rejection, rate queues, retries, and headers remain in the
provider clients that own them.

## Design

`provider-request-cancellation.js` provides four narrow operations:

1. validate an optional `AbortSignal` at the trusted service boundary;
2. combine it with a per-request timeout using `AbortSignal.any`;
3. stop awaiting an already-queued operation when the interactive budget
   expires; and
4. make queue and retry delays deadline-aware.

Every queue execution checks the signal before sleeping and again before
starting the provider operation. This matters because leaving a rate queue at
the six-second response deadline must not allow a request to begin later just
because a previous request finished. Each `fetch` receives the combined signal.
When the operation signal is aborted, clients rethrow the abort rather than
classifying it as a transient provider failure and retrying it.

The related-artists service creates the operation signal once, passes it to the
three direct provider reads and any allowed fallback work, then returns the
normalized best result available at expiry. The cache's `shouldPersist` hook
keeps a deadline-exhausted result request-local: it is served to the caller but
never upserts over durable SWR data.

## Security Properties

- Timeout and fan-out policy are server constants, not query parameters or
  client configuration.
- Cancellation errors, provider URLs, artist inputs, response payloads,
  cookies, credentials, and stack traces are not exposed by Artist Detail or
  cache diagnostics.
- Existing outbound-host allowlists, HTTPS-only validation, and redirect
  rejection continue to run before a request is queued.
- Stale durable cache data is retained when a background refresh is incomplete;
  the incomplete payload cannot replace it.
- The queue retains its rate-limit spacing. Cancellation reduces unnecessary
  work; it never bypasses the provider rate limit.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Per-provider bespoke cancellation | Small local edits | Duplicates subtle queue/retry behavior and drifts over time | Reject |
| Browser-provided timeout | Potentially user-configurable | Allows a client to alter server work and cache behavior | Reject |
| Cancel only `fetch` | Stops an in-flight request | Queued and backoff work can still start after the page has waited too long | Reject |
| Shared cancellation utility plus injected metadata budget | Consistent, testable queue/retry/fetch handling with narrow ownership | Adds explicit optional signal parameters to provider methods | Implemented |
| Process-global abort controller | Centralized control | Couples unrelated metadata operations and harms test isolation | Reject |

## Final Recommendation Stack

1. Keep provider-specific rate limiting and security validation in modular
   clients.
2. Use the shared cancellation utility only for trusted service-owned policy
   signals.
3. Set a total response budget at the metadata workflow that owns the user
   operation, not at the HTTP route.
4. Treat deadline exhaustion as a bounded, non-cacheable result, not a
   successful fresh cache fill or a browser-visible provider error.
5. Reassess a distributed provider limiter only if multiple application
   processes share the same egress identity.

## Outcome and Validation

The implementation is ES Module-only and consists of focused service files;
no global singleton or CommonJS module was introduced. Regression tests cover
the abort-before-queue-start and abort-without-retry cases, plus the
non-persistence cache contract. On 2026-08-22, the full repository validation,
controlled Artist Detail cache workload, and documented local Compose rebuild
all passed; the rebuilt service was healthy and bootstrap preserved the existing
disposable local admin.

## Official Sources

Sources accessed on 2026-08-22:

- [Node.js globals: AbortSignal](https://nodejs.org/dist/latest/docs/api/globals.html)
- [Node.js HTTP API](https://nodejs.org/api/http.html)
- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [MusicBrainz rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
