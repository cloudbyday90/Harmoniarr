# Local Docker rebuild after native fixture work

Date: 2026-10-20. Followed the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), with the
[native fixture design](NATIVE_SLSKD_FIXTURE_DESIGN.md) and outcome kept separate.

## Rebuild and startup

```powershell
docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
npm run validate:docker-provider-acceptance -- -- --readiness-only
```

The Linux/amd64 no-cache image is
sha256:39427ddc8947a6d507ef0b6f12e8f8f38a08c68d2e551933a3d1a8ad54d1ce80.
The running container matches it, is healthy/read-only, binds only app port
127.0.0.1:47956, and executes Node 24.22.0 on Linux/x64 as uid 1000. The
existing admin is confirmed and the one-shot bootstrap helper is removed.
Existing bind data and settings remain; no reset or data deletion was needed.

Readiness-only passes real login, configured-provider/path prerequisites and
bounded status reads. Provider status remains attention. No new search or
download is submitted; historical acceptance diagnostics are not a new transfer.
A password-only file outside the repository supplies the secret and is removed
in finally. Existing Compose Swarm-mode warnings and the documented local CSRF
opt-out remain unchanged; the application default remains required.

## Separate validation scopes

Full path/hash/mode inventories match the prior image for 852 server files,
151 client assets and six shared files. All 110 application package paths/
versions and 147 OS package entries match. package.json adds the explicit native
test script; this comparison does not claim identical whole-image bytes.

The [native outcome](NATIVE_SLSKD_FIXTURE_OUTCOME.md) records an isolated
internal-network test using this image's runtime/dependencies and mounted source,
with actual slskd 201 receipts and GET recovery. Its owned fixture has no
published ports and never uses walkthrough data or a public account. Native
remote queue admission does not diagnose this walkthrough's attention status
or establish downloaded/imported media.

Private evidence is under .tmp/native-peer-2026-10-20. Next: qualify slskd 0.26.1
with source review and this native lane; qualify the announced Node security
patch once published. The updated walkthrough remains available on loopback.
No registry image, release, Git tag, PR merge or new project branch is created.
