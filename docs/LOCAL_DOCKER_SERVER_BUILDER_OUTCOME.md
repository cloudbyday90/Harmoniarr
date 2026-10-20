# Local Docker server-builder rebuild

Date: 2026-10-20. Followed the applicable preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), after the
[server-builder design](SERVER_BUILDER_DESIGN.md) and isolated packaged checks.

## Executed rebuild

```powershell
docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
npm run validate:docker-provider-acceptance -- -- --readiness-only
```

The build explicitly targeted Linux/amd64. The running image is
sha256:9f193ccda73356730c879ae96e1979fb8590bc451f13198e4512ec222e7c6b90.
Its container is healthy/read-only, publishes only 127.0.0.1:47956 for the app,
and executes Node 24.22.0 on Linux/x64 as uid 1000. Existing bind data and
provider settings remain; bootstrap confirms the existing admin and the
one-shot helper is removed. No reset or data deletion was needed.

Readiness-only passes real UI login, configured-provider/path prerequisites
and bounded status reads. Provider status remains attention. Historical
acceptance diagnostics do not establish a new accepted transfer; this run
submits no provider search/download. A password-only file outside the repo
supplies the documented input and is removed in finally. Existing Compose
Swarm-mode warnings are retained. The documented walkthrough CSRF opt-out is
unchanged; the application default remains required.

## Evidence and follow-up

The separate [packaging outcome](SERVER_BUILDER_OUTCOME.md) records artifact
equality, 10,548 fast tests, fresh/restart/backup/request/upgrade proof and three
service-worker-enabled browser checks. It preserves the initial lost-baseline
reference failure and identifies the reconstructed baseline used for upgrade.
Private evidence is under .tmp/server-builder-2026-10-20.

Next: resolve the demonstrated baseline provider wire-version admission gap
from [PR 51 testing](OPEN_PR_51_SERVER_BUILDER_EVALUATION.md), with actual stable
version forms and batch/receipt proof. That isolated finding does not diagnose
this walkthrough's attention status. Recheck the announced Node security patch
when published. No registry image, release, Git tag or new branch was created;
the updated walkthrough remains available on its loopback port.
