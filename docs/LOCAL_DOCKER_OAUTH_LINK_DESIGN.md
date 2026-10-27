# OAuth linking Docker qualification design

October 27, 2026. Freeze final source/code bytes before one fourteen-stage fast
gate and npm audit. Rebuild the existing walkthrough using a fresh pull/no-cache
buildx builder. Preserve its administrator and all five inspected bind sources,
including the actual downloads override. Compare immutable server/client/shared
bytes and modes, package/binary provenance and metadata before recreation.

Six native entries cover new OAuth ownership plus existing Plex owner linking,
HTTPS, callback state, retention and linked login. Use fresh read-only UID-1000
containers, 3 GiB equal memory/swap, two CPUs, 256 PIDs, no network/ports and
disposable database/media tmpfs. Mount tests/helpers read-only; final production
code comes from the immutable image without overlays. Retire exact owned fixtures
and check absence. Retain unrelated session/KDF/media evidence only after exact
source/test/packaged implementation and runtime comparison.

The OAuth entry uses actual packaged PostgreSQL, real encrypted secrets and
mounted routes with controlled provider responses. For each provider it checks
browser/authority/configuration admission, post-provider revocation and account
lock waits, single consumption, exact state fences, clear/relink invalidation,
required audits, suppressed writes, final expiry, precommit visibility, maintenance
insertion, pool/lock bounds, refresh races/cancellation, real COMMIT acknowledgement
loss and actual backend retirement. Independent provider namespaces/revisions are
tested together. Operation-scoped checkout tracking verifies provider work holds
no owned checkout. Controlled responses do not establish live provider behavior or
exactly-once remote refresh/code exchange.

For each provider, a disposable fixture on the immutable image uses a loopback-only
published port and temporary host TLS proxy. Two Chromium contexts test Secure
host/HttpOnly Lax cookies, cross-site top-level return without the Strict refresh
cookie, other-browser refusal, stale tabs and replay. A public test certificate
exception is scoped to the fixture browser contexts. Production trust policy is
unchanged; existing native Plex HTTPS evidence is separate. Retire fixture
process/container/network, contexts and host servers with exit/absence evidence.

Recheck live walkthrough administrator login and one automatic no-store schema
diagnostic request with desktop/mobile screenshots. Automated checks do not replace
the deferred human screen-reader/physical-device acceptance. No release, branch,
PR merge or additional deployed service is part of qualification.
