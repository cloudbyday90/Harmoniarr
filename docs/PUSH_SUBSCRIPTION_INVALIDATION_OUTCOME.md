# Push subscription invalidation outcome

## Implemented behavior

Each accepted registration receives a new internal UUID token, including an identical re-registration at the same endpoint. The push service captures the original row ID, owner, endpoint, and token before preparing or sending a request. A 404 or 410 response invokes one conditional store update matching that original active registration. A refreshed, reassigned, or recreated registration survives a delayed response. A 412 response now reports a nonretryable failure and preserves the subscription.

The implementation extends the existing native ESM service and SQL store. It removes endpoint-only automatic cleanup, preserves the authenticated user-scoped unsubscribe API, and leaves the subscribe response unchanged. The additive migration initializes existing rows; the schema snapshot and critical column anchor include the token.

## Design and tradeoffs

Use token rotation, immutable captured identity, and atomic conditional invalidation. This covers identical-key re-registration without retaining cryptographic keys for cleanup. Its cost is one additional database column and a coordinated worker upgrade. Stop old workers before starting the new version; endpoint-only cleanup from old code would bypass this protection.

Cleanup remains asynchronous and best effort. Its failure cannot reject the delivery result, and diagnostics contain no raw subscription or provider data. A false update is benign. The existing expired status and legacy removed aggregate describe terminal attempts, not confirmed database mutations. This change does not replay an old queue item, revoke a provider-accepted message, guarantee browser display, or impose a database statement deadline.

The separate [design document](PUSH_SUBSCRIPTION_INVALIDATION_DESIGN.md) records the official September 2026 sources, W3C subscription lifecycle, alternatives, final stack, and open PR review. No applicable PR was applied or merged.

## Validation

Focused service and real PostgreSQL checks cover delayed responses across owner/key/identical refresh and deletion/recreation, caller-object mutation, incomplete identities, matching and repeated cleanup, 412 preservation, no endpoint fallback, contained diagnostics, and asynchronous cleanup. A two-client regression holds an actual registration upsert uncommitted, observes old cleanup waiting for its lock, then verifies that cleanup returns false after the new token commits. The reverse ordering restores an active registration with a new token.

Schema verification passed with 101 migrations and 109 critical anchors, including a fresh snapshot bootstrap. Dependency security validation reported zero npm audit vulnerabilities. These checks are not a comprehensive security audit or live-provider/browser delivery proof.

The local Compose walkthrough was rebuilt and replaced using the documented build, up, and bootstrap sequence while preserving existing data and deployment configuration. The container is healthy, `/healthz` returned HTTP 200, and bootstrap confirmed the existing admin. Image: `sha256:067f77bef273410a15660681799d9bb183f24cbcdedde65eff746eb35430b7f9`.

Full `npm run validate` passed migration/snapshot, copyright, ESM, Compose, lint and test-hygiene checks, all 8,515 tests (3,576 server, 4,287 client, 500 script, 152 integration), and client/server builds. No tests failed, skipped, or were cancelled.

## Next release item

Harden outbound push endpoint handling. The registration route currently accepts a nonempty endpoint, while the HTTPS transport permits any HTTPS host and port with normal DNS resolution. This is an existing boundary requiring review, not a demonstrated exploit from this change. Add bounded URL/key validation and a modular connection-time destination policy that addresses private/reserved IPv4 and IPv6 destinations and DNS changes while preserving TLS hostname verification and the existing no-redirect behavior. Evaluate a documented provider allowlist against support for standards-compatible push services before choosing it.

The tradeoff is tighter outbound access versus provider compatibility and additional DNS/address-policy maintenance. Prioritize this security boundary next; local queue-age expiry follows as the next reliability improvement. The recommendation is informed by the [OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), discovered and reviewed through online research.
