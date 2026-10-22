# Local Docker artwork image outcome

Completed October 22, 2026 using the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Image behavior and limitations belong
to the separate [application outcome](ARTWORK_IMAGE_DOWNLOAD_OUTCOME.md).

## Immutable artifacts

The isolated BuildKit builder used `--pull --no-cache --load`; it was removed
afterward and absence verified. Current local image:

`sha256:555444f71721e08a23129a1555a33262dfc05ea964d424270d4cf9db67a669f9`

Preceding baseline:

`sha256:479e90e575e8173c64dce629b355f50a96c0774382a55d51f22e563a013324f2`

Pinned build base:
`node:24.22.1-alpine3.23@sha256:4b00b6d1aa138805aace94cc2482808f2b4f01e5e9c9f8cdc0e217fd70600ef9`.
Pinned runtime base:
`alpine:3.23@sha256:85fe1e81d6758c208f3e1eed4338a1997e19d4be002d4dd32d3100c9a8c010a0`.

Exactly six of 882 server files changed: artwork fetch/ingestion, CAA client,
and the new image download, URL/error policy and raster-content policy modules.
Every other server file's bytes/mode match the baseline. All packaged server and
11 shared files match final local source. All 155 client artifacts are unchanged
and match the local build. Root package metadata, 110 production npm package
identities and 147 OS package identities are unchanged; no drift exception was used.

The candidate reports Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and bundled Undici
7.30.1. Node executable SHA-256 matches the preceding image:
`569128f3066ac7be59b10b9a0adef708def642ee37cbf9d560a9bdb68f872108`.

## Preserved startup and isolated validation

Compose started with `up -d --wait --no-build harmoniarr`, retaining the actual
completed-download mount override and all five bind mounts. The app is healthy
at `http://127.0.0.1:47956`, with a read-only root filesystem and Linux amd64
Node running as UID 1000. The existing admin/data are preserved. Bootstrap ran
with `--rm`, confirmed the existing account and left no helper container.

Startup applied zero migrations and verified 112 applied, zero pending.
Readiness-only validation passed with a temporary password-only file outside the
repository; removal and absence were verified. No reset, volume deletion, live
artwork-provider request, release, registry publication or tag was performed.

The exact candidate ran 21 native provider HTTPS checks serially in a separate
container with no external network, read-only source/test mounts, UID 1000, one
CPU, 256 MB memory and a 16 MB temporary filesystem. Actual PNG inspection,
rewrite and temporary-file publication used its production Linux Sharp stack.
The CA remained scoped to the owned child processes. A second isolated container
imported packaged ESM directly and verified URL refusal, body limits, real Sharp
rewrite/pixel refusal and approved CAA redirects. Both containers were removed
and their absence verified.

Private evidence is under ignored `.tmp/artwork-image-2026-10-22/`, including
before/after inventories, exact artifact comparison, build, migration, readiness,
native checks and retirement records. Readiness establishes preserved startup;
controlled assignment sinks establish ordering, not durable database writes or
live external service compatibility. Next, qualify connection-time destination
enforcement as described in the [application outcome](ARTWORK_IMAGE_DOWNLOAD_OUTCOME.md).
