# Push transport deadlines and claims acquired when ready

Design reviewed September 12, 2026, against baseline `0bf301a`.

Push queue claims now fence stale completion writes and protect claimed payloads. The worker still claims an entire batch before processing rows serially, and its Web Push request has no absolute deadline. Later rows can lose most of their lease while waiting behind an earlier request. A socket inactivity timeout alone would not bound a response that continues sending small chunks.

## Accepted budgets and scheduling

Use shared constants in `push-delivery-budget.js`: a 15-second transport budget, a 5-second completion reserve, the existing 60-second claim window, and at most 50 processed claims per heartbeat invocation. Acquire one row immediately before processing it, rather than reserving the whole batch. Await that row's complete worker result before claiming the next; stop when the queue returns no row or the invocation reaches its limit. Preserve fenced completion and counters based only on confirmed writes.

After subscription and current recipient-policy reads, obtain the current claim's remaining lease from PostgreSQL through `getNotificationClaimRemainingMs(id, { claimToken })`. The store matches ID, token, pending state, and unexpired lease using the database clock, returning milliseconds or null. Account conservatively for preflight latency by subtracting locally measured monotonic elapsed time from the returned value; do not compare application wall-clock timestamps with the database clock.

If the claim is no longer current, record a lost-claim outcome without transport. If the claim remains owned but has less than 20 seconds available after that adjustment, skip transport and use the existing bounded retry policy and conditional completion. Do not extend the lease or issue a request with insufficient time merely because the token still matches. A database preflight failure remains infrastructure failure and must not authorize a send.

The reserve leaves room for normal completion work; it is not a PostgreSQL statement timeout or a guarantee that persistence will finish within five seconds. A slow database write can still fail the existing token/expiry completion check. Just-in-time claims bound how much work is reserved ahead of the current row, not the wall-clock duration of an entire 50-row invocation.

## Absolute transport deadline

Retain the installed `web-push` library's encryption, content encoding, and VAPID construction through its supported `generateRequestDetails` API. Supply per-call VAPID details and the existing TTL explicitly. Send those generated request bytes through a small injectable native HTTPS transport rather than relying on `web-push.sendNotification` for cancellation.

The 15-second deadline covers request preparation and subsequent DNS/connect/TLS, headers, and response-body work. Begin timing before request preparation and share a monotonic `performance.now()` deadline with the transport; check the remaining budget before network creation. The transport owns an absolute timer that destroys the active request and response at expiry. A promise that merely stops awaiting the original send is insufficient because that send could still run after the worker schedules a retry.

Use a single-settlement lifecycle: handle synchronous request-construction errors, network errors, deadline expiry, response abort/error, response completion, and size limits. Clear timers on settlement, while safely handling late stream errors. Do not silently fall back to the original unbounded sender if the transport is absent or fails.

Limit response-body bytes to 64 KiB and discard them rather than retaining them in results or diagnostics. Set the native response-header limit to 16 KiB. Return only `{ statusCode, headers: { 'retry-after'?: string } }`, with an allowlisted Retry-After value bounded to 256 characters. Use fixed failure classifications such as `timeout`, `response_too_large`, `request_failed`, and `invalid_request`; never expose native error messages, provider bodies, endpoints, authorization headers, or subscription keys.

Only HTTPS requests are supported. Reject URL credentials and fragments; never follow redirects or accept arbitrary proxy, agent, or TLS-validation overrides from generated request options. Preserve normal certificate verification and pass the generated body/headers without reimplementing encryption. HTTPS scheme validation alone is not a private-address or DNS-rebinding defense; this slice must not claim a comprehensive outbound-address policy.

Node timers are not hard real-time interrupts. A blocked event loop can delay cancellation, and synchronous preparation cannot be interrupted by a timer callback. An elapsed-time check after preparation prevents starting a request whose budget has already been consumed. The transport enforces cancellation when the runtime can execute it; it does not guarantee an exact millisecond cutoff under process suspension.

## Result and security boundaries

Keep existing service-level classification of success, expired subscriptions, transient provider status, and bounded retry attempts. Timeouts and other transport failures become safe failed results, and the worker still uses the original claim token for any retry or terminal write. Unexpected persistence exceptions must not trigger a second ambiguous completion write. Replace raw endpoint/user/error diagnostics along the touched delivery path with fixed safe messages; preserve failure containment for diagnostic sinks.

The provider may accept a message before its response is lost, the deadline expires, or the database records success. Destroying a local request does not revoke a submitted provider message, and retrying may produce a duplicate. Neither the transport deadline nor the lease fence provides exactly-once delivery. Provider acceptance also does not prove browser delivery or user attention.

Current preference, account, administrator-only category, and subscription-owner checks remain before every network attempt. They are not held under locks through external I/O. No UI, browser permission prompt, focus, keyboard, or notification presentation change is required.

This slice adds no lease-renewal loop, local queue-age expiry, provider-delivery receipts, or new retry queue. The existing default provider TTL remains distinct from time spent waiting in Harmoniarr's queue.

## Official evidence

Sources were discovered through web search or previously discovered official links and opened for this review:

- [web-push official API documentation](https://github.com/web-push-libs/web-push) documents `generateRequestDetails`, its generated body/headers, and the distinction between socket inactivity timeout and full-response duration. The local installed version is 3.6.7. Its `src/web-push-lib.js` forwards `timeout` to native HTTPS and destroys on the socket timeout event; it also concatenates the response body without a byte cap. The proposed adapter retains request generation and replaces only transport ownership.
- [Node 24 HTTP documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html) states that a timeout option alone only emits an event; aborting a supplied `AbortSignal` behaves like destroying the request. The request/response event lifecycle informs cancellation and single-settlement cleanup.
- [Node 24 HTTPS documentation](https://nodejs.org/download/release/v24.18.1/docs/api/https.html) documents native HTTPS request options and the returned `ClientRequest`. These APIs support a small ESM transport without weakening TLS verification.
- [Node timer documentation source](https://github.com/nodejs/node/blob/main/doc/api/timers.md) explains that callbacks do not have exact timing guarantees. The deadline is an active cancellation mechanism, not a hard real-time execution guarantee.
- [RFC 8030, HTTP Web Push](https://www.rfc-editor.org/info/rfc8030/) distinguishes acceptance of a message from delivery to the user agent and defines provider retention through TTL. These limits remain after adding a client-side deadline.
- [W3C Push API](https://www.w3.org/TR/push-api/) distinguishes application-server submission, push-service processing, browser subscription permission, and browser delivery. The published document opened here is the December 1, 2025 Working Draft; it does not define a Harmoniarr queue lease or exactly-once contract.

## Alternatives and final recommendation stack

| Option | Advantages | Costs and limits |
| --- | --- | --- |
| Add only web-push socket timeout | Minimal change; terminates inactive sockets | Slow trickle responses can exceed the lease; no full-operation deadline |
| Race the current sender against a timer | Caller stops waiting promptly | Underlying request can continue and overlap a retry; rejected |
| Generated Web Push request plus bounded native HTTPS | Preserves established cryptography; owns real cancellation and bounded response handling | Adds a transport lifecycle requiring meaningful stream/error tests |
| Keep batch claims but increase lease length | Small scheduling change | Reserves work unnecessarily and only moves the timeout problem |
| Claim one row when ready plus remaining-budget preflight | Fresh lease for each send, bounded reserved work, respects current DB ownership | More claim queries; no parallel delivery throughput increase |

Choose library-generated encryption/VAPID, native HTTPS with an absolute deadline and response limits, shared budgets, one-row claims, a conservative database lease-budget check, and existing fenced completion/retry. Retain modular ESM factories and injected transport dependencies for deterministic tests. Local queue-age expiration is the next separate retention policy to assess after this timing boundary is validated.

## Open PR disposition

GitHub MCP returned three open PRs. Complete all-file patches and immutable heads were refreshed. None applies to the push transport or claim scheduling; none was applied or merged.

| PR | Immutable head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated controlled-provider fixture Node 24 to 26 major update |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build-push action 7.2 is superseded by local 7.3 |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2 |

## Validation and outcome boundary

Test cancellation before headers, after headers during a stalled/trickling body, request/response destruction, byte/header caps, malformed endpoints, redirects, safe result/error projection, and timer/listener cleanup. Use real library request generation to verify the adapter sends its encrypted bytes and VAPID/TTL headers. A local HTTPS fixture should observe the client connection closing after the absolute deadline; promise rejection alone is not proof of cancellation.

Scheduling tests must prove each next claim waits for the previous row's completion, each claim requests one row, the invocation cap holds, and queue exhaustion stops polling. Verify sufficient versus insufficient remaining lease, preflight-latency subtraction, no network on exhausted/unknown ownership, ordinary bounded retry, and unchanged fenced counters. Use real PostgreSQL for the remaining-lease query and preserve stale-token regressions. Record actual commands/results and remaining external-delivery ambiguity in the separate outcome document; no live push credentials or real browser delivery are required.
