# Push endpoint security outcome

## Implemented boundary

Harmoniarr now validates browser push registrations through dedicated native ESM endpoint and encryption-key modules. The route returns a fixed HTTP 400 error for invalid input before persistence; the service independently enforces the same contract. Stored subscriptions are validated again before encryption and delivery. Accepted endpoint capability strings remain unchanged in storage, including path and query encoding. User-scoped removal remains available for older subscriptions.

The endpoint policy requires a DNS hostname and HTTPS on port 443, with a 4096-byte bound. It rejects IP literals, numeric alternatives normalized by URL parsing, local/reserved names, ambiguous authority syntax, credentials, fragments, whitespace, and backslashes. Key validation requires canonical unpadded base64url, an actual 65-byte uncompressed P-256 public point, and a 16-byte authentication secret.

A dedicated destination resolver checks both A and AAAA results on each send, rejects any disallowed answer, bounds the combined answer count to 64, and pins one accepted public address into the HTTPS lookup callback. The connection retains the original Host header and TLS hostname verification. A per-send DNS resolver shares the existing absolute delivery deadline and is cancelled on timeout. Late results cannot open a connection. No second lookup, address fallback, reused agent, redirect, or production policy bypass is introduced.

Invalid subscription or blocked destination failures are nonretryable and do not invalidate registrations as though a provider had returned an expired endpoint. DNS infrastructure errors retain existing bounded retries. Diagnostics remain fixed and omit raw endpoint, key, address, and provider data.

## Recommendation stack and tradeoffs

Use the endpoint/key validator, conservative native IP classifier, cancellable per-send resolver, and pinned HTTPS transport together. This protects current and previously stored registrations against private destinations and a second DNS resolution changing the connection target. The implementation reuses existing queue claim fencing, recipient-policy checks, registration-token cleanup, and transport deadlines. No dependency or database migration is required.

The cost is intentionally narrower compatibility: HTTPS443 DNS hostnames only, no private push servers, no hosts-file/NSS resolution, no mixed safe/unsafe answers, and no same-attempt address failover. The IP policy excludes known special-purpose and transition ranges even when some are globally reachable. Deployment-specific routing, translation prefixes, DNS infrastructure, and trusted certificate authorities remain external trust boundaries. A provider-host allowlist would narrow destinations further but requires separate coverage and maintenance decisions.

The separate [design document](PUSH_ENDPOINT_SECURITY_DESIGN.md) records official September 2026 sources, W3C/RFC distinctions, alternatives, and all three open PR reviews. None of those PRs applies to this boundary; none was applied or merged.

## Validation and deployment

Focused registration/service/PostgreSQL checks passed 48 tests, and address/resolver/transport checks passed 24 tests. Independent review found no material production issue. Dependency-security checks reported zero npm audit vulnerabilities. Full `npm run validate` passed repository policy checks, lint, test hygiene, all 8,535 tests (3,596 server, 4,287 client, 500 script, 152 integration), and client/server builds. No tests failed, skipped, or were cancelled.

The documented local Docker build/up/bootstrap sequence completed with existing data and configuration preserved. The container is healthy, `/healthz` returned HTTP 200, and bootstrap confirmed the existing admin. Its final transport/resolver files match local source hashes. Image: `sha256:5b6302289fb7340f351cddf4327611d4b525cfafdf08ad1c85430f4f5eec77cc`.

 Synthetic subscription material and the local HTTPS certificate are test fixtures, not production credentials. The HTTPS fixture includes a public test hostname so tests retain real certificate-name verification while a test-only request adapter routes the socket to loopback. These tests do not establish live-provider acceptance or browser delivery, and dependency checks are not a comprehensive security audit.

## Next release item

Enforce a local queued-notification freshness deadline. Current claims consider pending status and next attempt time; each send passes the full stored provider TTL without checking how long the item waited locally. After extended downtime, stale notifications can still be sent with a fresh provider lifetime.

Define persisted expiry and coalescing semantics, check eligibility using database time before external I/O, and use existing claim-fenced terminal writes. The benefit is preventing obsolete notifications after delays; the cost is explicit expiry policy and migration/test coverage. Keep local queue age distinct from provider TTL and browser display guarantees.
