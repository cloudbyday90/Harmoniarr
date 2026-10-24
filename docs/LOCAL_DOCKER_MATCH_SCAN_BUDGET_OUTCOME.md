# Local Docker bounded-scan rebuild: outcome

Executed October 24, 2026 using the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The [feature outcome](ELIGIBLE_MATCH_SCAN_BUDGET_OUTCOME.md)
records behavior, research, tests and the next recommendation.

## No-cache build and exact comparison

A fresh temporary Buildx builder ran `--pull --no-cache --load`, then was removed
and confirmed absent. Qualified immutable image:

`sha256:9ca5398e55757ad5768fe857fa9d5c716830e4f76078051278e0156cc98fc93c`

Inventory and source/runtime comparison completed before the live restart. The
922 server, 11 shared and 155 client files match the intended source and local
client build. Six server files changed, including the two new scanner/page factory
services; every other server/shared file matches the previous image. Fifty-six
client assets changed through rebuilt bundles. Root manifests, Node binary, npm
12.0.2, 110 production npm packages and 151 APK packages match the prior image
exactly. Node remains 24.22.1 with the existing Sharp/libvips, FFmpeg/FFprobe and
PostgreSQL runtime.

## Preserved walkthrough

Compose restarted with `--wait --no-build` and the actual existing downloads
override. Before/after inspection confirms all five actual bind mounts and their
read/write settings are preserved. Existing administrator/data remain; bootstrap
confirmed the existing account and its one-shot helper was retired.

The deployment is healthy, Linux amd64 UID 1000, with a read-only root and only
`127.0.0.1:47956` published. Database preparation verified 112 applied migrations,
zero pending and zero newly applied. The authenticated readiness-only command
passed, with a password-only temporary file outside the repository that was removed
afterward. It submitted no live provider transfer. No reset, version bump, Git tag
or release was created.

## Qualification boundaries

Both isolated packaged verifiers passed on this exact immutable image:

- Controlled-provider pipeline: seventeen catalogue fixtures, successful actual
  download/apply, durable initial quality refusal, separate successful recovery
  and exhausted-quality review. Missing owner, disabled owner and revoked
  monitoring each refuse application with zero additional provider transfers
  and unchanged library files.
- File-backed music queue: authentic FLAC reaches applied state through the
  existing mapping recovery; the transcoded source remains failed in durable
  preflight review. Existing collision/strict-quality and packaged media checks
  remain green.

Both projects removed their containers, volumes, networks and temporary workspaces.
Inventory containers, the temporary builder and bootstrap helper were retired too.
These are controlled providers and generated local media, not a public Soulseek
account or live user-library workload.

Exact comparison retains prior native memory/admission qualification for the
unchanged workers, limiters and runtime packages. It does not establish a new
RSS, whole-container memory, database query-plan, public-provider or manual
assistive-technology measurement. The new structural bound covers candidate facts
fetched/evaluated in detail reads; complete transactional command checks retain
their separate work and authority.
