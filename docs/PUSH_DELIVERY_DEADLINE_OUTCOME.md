# Push delivery deadlines and scheduling outcome

## Delivered design

The queue claims one row only when ready to process it, up to 50 rows per invocation. It does not claim the next row until the current attempt and its fenced completion finish. A fresh database query returns the current token's remaining lease. The worker conservatively subtracts the full monotonic preflight query duration, then requires at least 20 seconds: a 15-second transport deadline plus a five-second completion reserve.

Insufficient budget prevents network I/O and uses the existing bounded retry path. Missing or expired ownership remains a lost claim. Fenced completion still determines outcome counters. The reserve is not a database statement timeout, and a blocked event loop can delay timer callbacks; the design does not promise hard real-time behavior.

The native HTTPS adapter retains web-push request generation for encryption and VAPID and owns cancellation of the actual request. It bounds response data and returns safe status/Retry-After information. A timeout can still follow provider acceptance, so retries may duplicate a notification.

## Validation

Completed focused validation:

- All 33 transport/service tests and 27 scheduling/worker tests passed.
- Real HTTPS fixtures verified socket closure for pre-header stalls and continuously trickling bodies, certificate validation, response body/header limits, and no redirect following. A native unresolved-DNS request was destroyed at its deadline. Real web-push generation preserved encrypted bytes and VAPID/TTL headers through the adapter.
- Three real PostgreSQL regressions passed, proving just-in-time claims, remaining-lease deferral, stale-token fencing, coalescing, and recipient preferences.
- Copyright, ESM checks, client/server builds, and `npm run validate:security` passed. npm audit reported zero vulnerabilities; this is not a comprehensive security audit.
- The local Docker walkthrough was rebuilt from final production files using `docs/LOCAL_DOCKER_WALKTHROUGH.md`. Saved configuration and data mounts were retained, bootstrap confirmed the existing administrator, container health is healthy, and `/healthz` returned HTTP 200 at `http://127.0.0.1:47956`.

Image: `sha256:f9b9d1b74f60877406c01b3ea16f8885730489f964be858a7d28e704c97bbd72`.

Full `npm test` passed all lint targets, test hygiene, and 8,506 tests: 3,568 server, 4,287 client, 500 script, and 151 integration tests. None failed, skipped, or were cancelled. No live push credentials or browser-delivery evidence is claimed. The committed localhost TLS certificate and private key are public synthetic test fixtures, trusted only through test injection.

## Recommendation and tradeoffs

Use shared timing constants, a narrow native HTTPS transport, just-in-time claims, current database lease checks, and existing fenced completion/retries. This prevents a slow response from intentionally extending socket activity forever and avoids consuming waiting rows' leases. Costs include an additional query per attempt and conservative deferral when reads are slow. A tick is count-bounded; its elapsed duration still depends on up to 50 attempts and database responsiveness.

No database lock spans HTTP I/O. Process suspension, ambiguous provider acceptance, database completion failures, and browser delivery remain outside an exactly-once guarantee. Provider TTL still does not impose a local queue-age expiry.

## Next release item

Make expired-subscription cleanup conditional on the original subscription identity, owner, and key revision. The current endpoint-only invalidation can disable a subscription that was reassigned or refreshed while an older request was in flight and later returned an expired response. Test that race using controlled in-flight delivery and preserve the new registration.

See the separate [design, official September 2026 sources, alternatives, and PR disposition](PUSH_DELIVERY_DEADLINE_DESIGN.md).

The conditional cleanup follow-up is now implemented; see [subscription invalidation outcome](PUSH_SUBSCRIPTION_INVALIDATION_OUTCOME.md) for its separate design, evidence, and next release item.
