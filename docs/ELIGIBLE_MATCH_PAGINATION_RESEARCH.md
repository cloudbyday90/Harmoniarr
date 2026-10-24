# Eligible-match pagination: research and recommendation

Official sources discovered and opened through Search MCP on October 24, 2026.
Recommendations apply to the current PostgreSQL 18 and Vue platform.

| Choice | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Bidirectional UUID keysets | Unique order; avoids growing OFFSET skips | Live membership changes; no numbered total | Adopt |
| Replace twelve results | Bounded DOM and client state | More deliberate navigation | Adopt |
| Append every page | Easy continuous comparison | Growing memory, DOM and history | Defer |
| Signed, scoped continuation | Detects tampering and stale policy | Process restart invalidates cursors | Adopt |
| Snapshot all candidate IDs | Frozen browsing | Retained state and expiry/storage complexity | Defer |
| Existing detail request gate | Unified authorization, cancellation and polling | Full bounded detail is reread | Adopt |

[PostgreSQL 18 LIMIT/OFFSET](https://www.postgresql.org/docs/18/queries-limit.html)
requires a uniquely constrained order for predictable limited results and explains
that skipped OFFSET rows still require server work. UUID keysets are our design
inference from that guidance; the documentation does not mandate this API.

[OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
recommends least privilege, default denial and permission checks on each request.
Therefore every page resolves the current target, recomputes shared quality scope
and retains independent transactional selection authority. A valid cursor alone
is never permission to view or mutate a release.

[W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
explains programmatic status announcements without focus movement. Apply a
persistent polite status region for loading, completed navigation and resets;
keep native navigation controls stable. Automated browser evidence supplements,
but cannot replace, the deferred screen-reader and physical-device checks.

## Final recommendation stack

[Node.js 24 crypto documentation](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html)
documents keyed HMAC digests and equal-length constant-time byte comparison.
Use a random 32-byte process-local key, HMAC-SHA-256 and `timingSafeEqual` for the
cursor signature. This authenticates navigation state; it does not encrypt it or
make surrounding authorization checks unnecessary. Restart invalidation avoids
adding a persistent secret or a cursor database for this bounded read feature.

1. Existing Vue disclosure and detail composable with bounded page replacement.
2. Existing authenticated, rate-limited detail GET with a validated cursor query.
3. Small ESM cursor policy and shared quality-review eligibility/scanning service.
4. Narrow parameterized PostgreSQL keyset store, twelve results plus lookahead.
5. Existing fresh transactional selection, required audit and explicit download.

This adds no dependency, database migration, external service or release. Next
consider measured scan-work admission with an explicit incomplete-continuation
contract; a silent scan cutoff would falsely authorize Search again.
