# Local Docker eligible-page rebuild: outcome

Executed October 24, 2026, following the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The [feature outcome](ELIGIBLE_MATCH_PAGINATION_OUTCOME.md)
owns behavior, standards, tests and the next recommendation.

## Build and preserved deployment

A fresh temporary Buildx builder built with `--pull --no-cache --load`, then was
removed and confirmed absent. Qualified immutable image:

`sha256:f7497451faceb30cca3199088e6450a4d4e83091f53e3a813e3fc00a01dbef32`

The image was inventoried and compared before the live restart. Its 920 server,
11 shared and 155 client files match the intended source/local client build.
Exactly five server files changed, including the new cursor policy; every other
server/shared file matches the preceding image. Fifty-seven client assets changed
through the rebuilt bundles. Root manifests, Node binary, npm 12.0.2, 110 production
npm packages and 151 APK packages match the previous image exactly. Node remains
24.22.1, with the existing Sharp/libvips, FFmpeg/FFprobe and PostgreSQL runtime.

Compose restarted with `--wait --no-build` and the actual existing downloads
override. Before/after comparison proves all five actual bind mounts and their
read/write settings are preserved. Existing administrator/data remain; bootstrap
confirmed the existing account and its one-shot helper was removed. The deployment
is healthy, Linux amd64 UID 1000, with a read-only root and only
`127.0.0.1:47956` published. Database preparation verified 112 applied migrations,
zero pending and zero newly applied.

The authenticated readiness-only command passed. Its password-only temporary file
was outside the repository and removed afterward. The command did not submit a
live provider transfer. No walkthrough reset, release, version bump or Git tag occurred.

## Packaged application and media proof

Both existing isolated verifiers passed against this exact immutable image:

- Controlled-provider pipeline: seventeen catalogue fixtures, actual successful
  download/apply, durable initial media refusal, successful separate recovery and
  exhausted-quality review. Missing owner, disabled owner and revoked monitoring
  each refuse application with zero additional provider transfers and unchanged
  library files.
- File-backed music queue: authentic FLAC reaches applied state after the existing
  mapping recovery; the transcoded source remains failed in durable preflight
  review. Existing collision/quality and actual packaged-media checks pass.

Both disposable projects retired their containers, volumes and networks; their
temporary workspaces are absent. Inventory containers, temporary builder and
bootstrap helper were also removed. These proofs use controlled providers and
generated local media rather than a public Soulseek account or live library job.

## Qualification boundaries

The exact comparison retains the previous native memory/admission qualification
for unchanged worker/limiter code and runtime packages. It does not constitute a
new RSS, whole-container memory, public-provider or manual assistive-technology
measurement. Pagination bounds retained facts and client DOM; sparse scan work
remains the next feature follow-up.
