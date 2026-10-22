# Local Docker shared artwork ingestion outcome

Completed October 22, 2026 through the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Behavior and measurement limits belong
to the separate [ingestion outcome](ARTWORK_INGESTION_BUDGET_OUTCOME.md).

## Immutable artifacts

The owned BuildKit builder used `--pull --no-cache --load`; removal and absence
were verified. Current local image:

`sha256:3bce38540e6c4c6afb7eabc709a09f814b9e337b313e91945b31068193ad8d55`

Preceding baseline:

`sha256:542fdcd567545d227365fc4e01e0972412d8df9c0992d58cac46349a46a35617`

Pinned build base:
`node:24.22.1-alpine3.23@sha256:4b00b6d1aa138805aace94cc2482808f2b4f01e5e9c9f8cdc0e217fd70600ef9`.
Pinned runtime base:
`alpine:3.23@sha256:85fe1e81d6758c208f3e1eed4338a1997e19d4be002d4dd32d3100c9a8c010a0`.

Exactly seven of 892 server files changed or were added: the shared work scheduler,
fetch adapter, ingestion adapter/service, file reader, content policy and processing
module. Every other server/shared file's bytes/mode match the baseline. All packaged
server and 11 shared files match final source. All 155 client artifacts are unchanged
and match the local build. Root package metadata, 110 production npm package identities
and 147 OS package identities are unchanged; no drift exception was used.

The candidate reports Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and bundled Undici
7.30.1. Node executable SHA-256 matches the preceding image:
`569128f3066ac7be59b10b9a0adef708def642ee37cbf9d560a9bdb68f872108`.

## Preserved startup and independent qualification

Compose started with `up -d --wait --no-build harmoniarr`, preserving the actual
completed-download mount override and all five bind mounts. The app is healthy
at `http://127.0.0.1:47956`, with a read-only root filesystem and Linux amd64 Node
running as UID 1000. Existing admin/data are preserved. Bootstrap ran with `--rm`,
acknowledged the existing admin and left no helper container.

Startup applied zero migrations and verified 112 applied, zero pending.
Readiness-only validation passed with a temporary password-only file outside the
repository; removal and absence were verified. No reset, volume deletion, live
provider request, release, registry publication or tag was performed.

The exact image ran 80 checks serially in a separate container with no external
network, read-only source/test mounts, UID 1000, one CPU, 256 MB memory and a 16 MB
temporary filesystem. Coverage includes existing real HTTPS/Sharp journeys, actual
Linux FIFO refusal and growing-file handle limits. Fixture trust remained child-
scoped. The complete cohort passed; its container was removed and absence verified.

Another isolated container imported packaged ESM directly and passed weighted
admission/cancellation, fetch compatibility, bounded handle growth/close and FIFO
refusal under the same restrictions. It too was removed with absence verified.
Separate baseline/candidate workload containers used one CPU, 512 MB memory and
64 MB temporary storage for six real one-megapixel ingestions. The earlier baseline
was repeated after a fixture cleanup refinement; all measurement containers were
removed and absence verified. The [owning outcome](ARTWORK_INGESTION_BUDGET_OUTCOME.md)
records exact output equivalence and observed work/RSS rather than a memory ceiling.

Private inventories, build, migration, readiness, native tests, measurements and
retirement evidence remain under ignored `.tmp/artwork-ingestion-2026-10-22/`.
Controlled asset/assignment sinks do not establish database transaction durability;
fixture DNS/routing does not establish live-provider acceptance. One-megapixel
measurement does not qualify maximum-policy inputs or native-failure containment.
Next, qualify isolated native image workers before claiming a hard memory boundary.
