# Local Docker runtime closure rebuild

Date: 2026-10-19. Followed the existing
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), preserving its configured data and
provider settings. The [closure design](RUNTIME_DEPENDENCY_CLOSURE_DESIGN.md)
and [PWA reload design](PWA_SERVICE_WORKER_RELOAD_DESIGN.md) own the code changes.

## Rebuild and preserved-state startup

Executed in order:

```powershell
docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
npm run validate:docker-provider-acceptance -- -- --readiness-only
```

The build targeted Linux/amd64 and produced local immutable image
sha256:f68b2d9230d8d982a64e51a465d873abf53a1ac37f96430c3964f2106c58e0ed.
The actual running container matches that image, is healthy/read-only and binds
3000/tcp to 127.0.0.1:47956. Its executed runtime is Node 24.22.0, Linux/x64,
uid 1000. Bootstrap succeeded with an already-existing admin; the one-shot helper
was removed. Existing bind-mounted walkthrough state was retained.

Compose reported existing warnings that deploy.mode and ports[].mode are
Swarm-only. These warnings were retained; no Compose semantics were changed.
The walkthrough's explicit local CSRF opt-out remains as documented. Separate
native/browser controls verify the application's required default policy.

The readiness-only command passed through the real browser login, configured
provider/path prerequisites and bounded status reads. Provider status remains
attention. Historical acceptance diagnostics are not a newly submitted or
accepted transfer. No new provider search/download was initiated. A temporary
password-only file supplied the documented input and was removed afterward.

## Isolated packaged proof

Before updating the walkthrough, the same final immutable image passed a separate
disposable Compose fresh-install/restart flow. It verifies PostgreSQL persistence,
108 applied/zero pending migrations, media binaries, backup/restore lock refusal
and apply, request flow and strict owned-project cleanup. Fresh browser contexts
with service workers enabled pass actual login and lazy settings navigation in
both phases. Each preserves the document across first claim, with no script or
asset errors. This is local packaged proof, not a release or live-provider test.

Physical inventory contains 110 app packages and matches the package-only
candidate; all 151 client assets match the final tested host build. The separate
[closure outcome](RUNTIME_DEPENDENCY_CLOSURE_OUTCOME.md) retains the old-image
negative control and package-only asset equality.

Private evidence: .tmp/runtime-closure-2026-10-19. No image was published, no
release/tag was created, and the walkthrough remains available on its loopback
port. Next: give the smoke harness Docker-owned loopback port allocation, then
qualify the announced Node security patch when published. Retain provider
attention as a separate operational follow-up requiring operator diagnosis.
