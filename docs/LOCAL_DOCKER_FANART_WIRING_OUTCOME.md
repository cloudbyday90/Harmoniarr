# Local Docker Fanart.tv wiring outcome

Completed October 22, 2026, following the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Application and transport behavior is
recorded in the separate [owning outcome](FANART_WIRING_OUTCOME.md).

## Build and artifact identity

The isolated BuildKit builder used `--pull --no-cache --load` and was removed
afterward, with absence verified. The local image is:

`sha256:479e90e575e8173c64dce629b355f50a96c0774382a55d51f22e563a013324f2`

Its baseline was:

`sha256:61f1bd92664c072284f09bb0374578cbbf7955874562fa7385febbb72bcb9fde`

The pinned Node build base remains
`node:24.22.1-alpine3.23@sha256:4b00b6d1aa138805aace94cc2482808f2b4f01e5e9c9f8cdc0e217fd70600ef9`;
the runtime base remains
`alpine:3.23@sha256:85fe1e81d6758c208f3e1eed4338a1997e19d4be002d4dd32d3100c9a8c010a0`.

Exactly four of 879 packaged server files changed: `app.js`,
`artwork/artwork-module.js`, `integrations/fanart-tv/fanart-client.js` and the new
`integrations/fanart-tv/fanart-image-selection.js`. All remaining server bytes and
modes match the baseline. All 155 client artifacts and 11 shared files match
their local inputs; client artifacts are unchanged from the preceding image.
Every packaged server/shared file was compared with final source. Root package
metadata, all 110 production npm package identities and all 147 OS package
identities are unchanged. No package-drift exception was applied.

The candidate reports Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and bundled Undici
7.30.1. Its Node executable matches the preceding image:
`569128f3066ac7be59b10b9a0adef708def642ee37cbf9d560a9bdb68f872108`.

## Preserved walkthrough and isolated checks

Compose started with `up -d --wait --no-build harmoniarr` and retained the actual
completed-download mount override. All five existing bind mounts are unchanged.
The existing admin/data were preserved; the bootstrap helper confirmed the
existing account, ran with `--rm`, and left no helper container.

The app is healthy at `http://127.0.0.1:47956`, with a read-only root filesystem
and Linux amd64 Node running as UID 1000. Startup applied zero migrations and
verified 112 applied, zero pending. Readiness-only validation passed using a
temporary password-only file outside the repository; that file was removed and
its absence verified. No reset, volume removal or live Fanart.tv request occurred.

The exact candidate also ran 18 native HTTPS tests serially in a separate
network-isolated container. Source/test mounts were read-only; its production
Linux dependencies came from the candidate image. A second isolated container
imported packaged modules directly and checked stored-key rotation, clearing to
environment fallback, exact nested album selection and private credential failure.
Both containers were removed and their absence verified.

Private evidence is under ignored `.tmp/fanart-wiring-2026-10-22/`, including
inventories, comparison, build, migration, readiness, native transport and
retirement records. Readiness is startup evidence; controlled image/assignment
sinks are ordering evidence. Neither proves a new live download or durable
provider ingestion. No release, registry publication or tag was created.

Next follow-up: qualify the image downloader before live artwork acceptance, as
specified in the [application outcome](FANART_WIRING_OUTCOME.md).
