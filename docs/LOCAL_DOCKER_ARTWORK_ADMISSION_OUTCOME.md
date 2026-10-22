# Local Docker artwork admission outcome

Completed October 22, 2026 through the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Application behavior and limits belong
to the separate [admission outcome](ARTWORK_ADMISSION_OUTCOME.md).

## Immutable artifacts

The owned BuildKit builder used `--pull --no-cache --load`; removal and absence
were verified. Current local image:

`sha256:542fdcd567545d227365fc4e01e0972412d8df9c0992d58cac46349a46a35617`

Preceding baseline:

`sha256:d378b51e7ada02f97a85900830bb2b232371f3a328d64cfb7dcc8ae8f81ebd49`

Pinned build base:
`node:24.22.1-alpine3.23@sha256:4b00b6d1aa138805aace94cc2482808f2b4f01e5e9c9f8cdc0e217fd70600ef9`.
Pinned runtime base:
`alpine:3.23@sha256:85fe1e81d6758c208f3e1eed4338a1997e19d4be002d4dd32d3100c9a8c010a0`.

Exactly four of 888 server files changed or were added: artwork-fetch-service,
artwork-fetch-admission, artwork-fetch-batch and artwork-fetch-request. Every
other server/shared file's bytes and mode match the baseline. All packaged server
and 11 shared files match final source. All 155 client artifacts are unchanged
and match the local build. Root package metadata, 110 production npm package
identities and 147 OS package identities are unchanged; no drift exception was used.

The candidate reports Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and bundled Undici
7.30.1. Node executable SHA-256 matches the preceding image:
`569128f3066ac7be59b10b9a0adef708def642ee37cbf9d560a9bdb68f872108`.

## Preserved startup and isolated checks

Compose started with `up -d --wait --no-build harmoniarr`, retaining the actual
completed-download mount override and all five bind mounts. The app is healthy
at `http://127.0.0.1:47956`, with a read-only root filesystem and Linux amd64
Node running as UID 1000. Existing admin/data are preserved. Bootstrap ran with
`--rm`, acknowledged the existing admin and left no helper container.

Startup applied zero migrations and verified 112 applied, zero pending.
Readiness-only validation passed with a temporary password-only file outside the
repository; removal and absence were verified. No reset, volume deletion, live
artwork-provider request, release, registry publication or tag was performed.

The exact image ran 65 checks serially in a separate container: 11 native HTTPS
checks and 54 admission/service/module/HTTP checks. It used no external network,
read-only source/test mounts, UID 1000, one CPU, 256 MB memory and a 16 MB temporary
filesystem. The initial run lacked a transitive HTTP test-fixture mount; the
corrected run passed without an application/image change. Both containers were
removed and absence verified; the failed run remains separately documented.

A third isolated container imported packaged ESM directly and passed queue
overflow/cancellation, default shared slots across batch/single requests, batch
bounds and seven actual Sharp/file publications. It used the same resource and
network restrictions, and was removed with absence verified. Fixture TLS trust
remained child-scoped. Controlled assignment sinks do not establish database
transaction durability, and controlled DNS/routing do not establish live service
acceptance. Tiny-image success under 256 MB does not qualify worst-case memory.

Private inventories, build, migration, readiness, checks and retirement evidence
remain under ignored `.tmp/artwork-admission-2026-10-22/`. Next, qualify resource
admission for direct ingestion and derivative generation as described in the
[application outcome](ARTWORK_ADMISSION_OUTCOME.md).
