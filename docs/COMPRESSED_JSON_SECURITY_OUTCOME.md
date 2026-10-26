# Compressed JSON parser security outcome

October 26, 2026. See the [design and primary references](COMPRESSED_JSON_SECURITY_DESIGN.md)
and [combined validation outcome](BACKUP_FAILURE_PRECEDENCE_OUTCOME.md).

The dependency audit reported high-severity CVE-2026-111181 in body-parser 2.3.0.
The production parser uses the affected default decompression behavior. A child
probe using that actual factory reproduced an unhandled decoder error and exit 1
after trailing bytes arrived beyond a completed compressed frame. It ran on an
owned loopback test server, not the live application.

The lockfile now selects body-parser 2.4.0 and required qs 6.16.1 within the existing
Express dependency ranges. There is no new direct dependency, override, parser
fork or compression-policy change. These are the only changed runtime npm package
versions in the final image. The complete installed-tree npm audit reports zero
advisories at validation time; that is not a general security guarantee.

The repaired child completes split deflate trailing-body, gzip trailing-body,
valid gzip and follow-up health checks with status 200 and verified JSON. The
split case waits for actual raw-request completion, without a success delay or
global uncaught-exception handler. Normal child/stdout close is owned by the
test helper. Upstream accepts the valid decoded prefix and drains trailing bytes;
this does not claim rejection of all malformed input.

The shared test-only ESM probe passes in the fast suite and in the guarded final
image using `/app/server-dist/http-hardening.js`. The latter uses packaged parser
code and runtime dependencies, not a mounted replacement implementation. Five
combined native entries and the final 11,227 fast tests pass; rebuilt login and
router behavior also pass. No full HTTP/security scan or compression-bomb/corpus
qualification is claimed. Existing request-size, CSRF, authorization and private
storage policies are unchanged.

Initial audit/crash evidence remains under
`.tmp/backup-failure-precedence-2026-10-26/`; final packaged proof is under
`.tmp/backup-failure-precedence-final-2026-10-26/`. No release was created.
