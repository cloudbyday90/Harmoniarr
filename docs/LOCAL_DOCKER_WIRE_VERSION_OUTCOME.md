# Local Docker provider-version rebuild

Date: 2026-10-20. Followed the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) after the
[wire-version design](SLSKD_WIRE_VERSION_DESIGN.md) and isolated validation.

## Executed commands and runtime

```powershell
docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
npm run validate:docker-provider-acceptance -- -- --readiness-only
```

The Linux/amd64 no-cache build produces immutable local image
sha256:05a1b489efcc76be8b474ac0c4dab15e721875528f39decf72ca0d0a72648013.
The actual container matches it, is healthy/read-only, publishes app port 3000
only on 127.0.0.1:47956, and executes Node 24.22.0 on Linux/x64 as uid 1000.
Bootstrap confirms the existing admin; its disposable helper is removed.
No reset or bind-data deletion is performed. Existing Compose Swarm-mode
warnings and the documented local CSRF opt-out remain unchanged.

Readiness-only passes real UI login, configured-provider/path prerequisites
and bounded status reads. Provider status remains attention. This run submits
no search/download; historical acceptance diagnostics are not a new transfer.
The separate native version finding does not diagnose that attention status.
A password-only file outside the repo supplies the secret input and is removed
in finally. No password is written to the evidence artifact or command line.

## Packaged comparison and follow-up

Full path/hash/mode comparison against the retained prior image changes only
slskd/slskd-download-protocol-policy.js, matching frozen source SHA-256
b13fadcf80ffc48d16f10ae0e2a955caa8dc72d04258bb27b8afcbd925eeb291.
The other 851 server files, 151 client assets, six shared files, 110 application
package paths/versions and 147 OS package entries match. The independent
[outcome](SLSKD_WIRE_VERSION_OUTCOME.md) records real provider refusal checks
separately from successful PostgreSQL/controlled-HTTP receipt evidence.

Private evidence is under .tmp/slskd-wire-2026-10-20. Next: qualify successful
native batch/receipt behavior in an isolated provider/peer fixture before
adopting 0.26.1, and qualify the announced Node security patch once published.
The updated walkthrough remains available on its loopback port. No image is
published to a registry, and no release, Git tag or new branch is created.
