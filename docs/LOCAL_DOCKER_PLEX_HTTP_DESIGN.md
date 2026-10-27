# Plex HTTPS Docker qualification design

October 27, 2026. Freeze final source and changed code bytes, run one complete
fourteen-stage fast gate and npm audit, then rebuild the existing walkthrough
with a fresh `--pull --no-cache` buildx builder. Preserve administrator credentials
and all five inspected bind sources, including the actual downloads override.
Compare immutable image source/modes, runtime binaries, npm/OS packages, metadata
and client build before recreation. No release, tag or separate branch is needed.

Four native entries qualify owned HTTPS, callback state, retention and linked
login. Use fresh read-only UID-1000 containers at 3 GiB, two CPUs, 256 PIDs,
matching memory/swap caps, no network/ports and disposable tmpfs database/media.
Mount tests/helpers read-only; final implementation comes from the immutable image
without source overlays. Retire and check absence of each exact owned fixture.

The new HTTPS entry uses real native HTTPS/TLS and PostgreSQL. A **public test
key/certificate** with Plex SANs is trusted only by its injected loopback request
router. The production options still require TLS verification and the expected
servername. A matching positive, untrusted certificate and trusted wrong-name
certificate distinguish trust from hostname checks. No CA is installed, global
TLS policy is not changed, and rejectUnauthorized is never disabled. Fake public
DNS answers pass production address validation before the router maps them to
loopback. A held actual lookup callback establishes post-deadline drain ownership.
This is controlled native TLS/DNS evidence, not live Plex/public DNS acceptance.

Exercise all five endpoint contracts, exact body limit, declared/chunked overflow,
header overflow, compression refusal, malformed UTF-8/JSON, truncation, redirect
trap, fixed error privacy, header/body stalls, private DNS and native closes.
The mounted callback must not publish a session, success audit or cookie after a
provider timeout; explicit retry must succeed. Existing callback/retention/linked
entries use a small controlled-response transport helper and remain separate from
real native HTTPS evidence. Their response fixtures contain public constants only.

Retain unrelated password/KDF/session/media proof after exact unchanged source/
test/runtime comparison. Repeat secure-cookie browser navigation using the new
internal controlled-transport seam: two isolated contexts, cross-site return,
independent tabs and replay. Its loopback proxy uses a scoped browser certificate
exception; that is separate from the native TLS lane's full trust/hostname checks.
Retire that disposable app, contexts, proxy and private bridge. Do not infer total RSS, minimum
memory, performance, live provider compatibility or complete WCAG acceptance from
these correctness checks. Identity-only responses, body limits, no connection
reuse/proxy support and per-request rather than workflow deadlines are explicit
compatibility limits.

Verify packaged entrypoint identity and the private data-bind publication/readiness/
collision probe. Exercise existing-admin browser login and automatic schema
diagnostics, inspect desktop/mobile screenshots, retire the helper/builder/private
password file, and leave unrelated containers unchanged. Record exact identities,
counts, cleanup, failed preflights and PR discovery in the
[Docker outcome](LOCAL_DOCKER_PLEX_HTTP_OUTCOME.md).
