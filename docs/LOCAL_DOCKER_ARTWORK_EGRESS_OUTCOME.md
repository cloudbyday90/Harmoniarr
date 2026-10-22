# Local Docker artwork egress outcome

Completed October 22, 2026 through the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Application behavior and limits belong
to the separate [egress outcome](ARTWORK_EGRESS_OUTCOME.md).

## Immutable artifacts

The owned BuildKit builder used `--pull --no-cache --load`; removal and absence
were verified. Current local image:

`sha256:d378b51e7ada02f97a85900830bb2b232371f3a328d64cfb7dcc8ae8f81ebd49`

Preceding baseline:

`sha256:555444f71721e08a23129a1555a33262dfc05ea964d424270d4cf9db67a669f9`

Pinned build base:
`node:24.22.1-alpine3.23@sha256:4b00b6d1aa138805aace94cc2482808f2b4f01e5e9c9f8cdc0e217fd70600ef9`.
Pinned runtime base:
`alpine:3.23@sha256:85fe1e81d6758c208f3e1eed4338a1997e19d4be002d4dd32d3100c9a8c010a0`.

Exactly seven of 885 server files changed or were added: the artwork downloader
and new HTTPS transport, CAA default composition, two shared network modules and
two Push compatibility adapters. Every other server/shared file's bytes and mode
match the baseline. All packaged server and 11 shared files match final source.
All 155 client artifacts are unchanged and match the local build. Root package
metadata, 110 production npm package identities and 147 OS package identities
are unchanged; no drift exception was used.

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

The exact image ran 52 checks serially in a separate container: 28 native provider
HTTPS checks and 24 Push policy/resolver/transport checks. It used no external
network, read-only source/test mounts, UID 1000, one CPU, 256 MB memory and a 16 MB
temporary filesystem. Actual image rewrite used its production Linux Sharp stack.
Fixture trust remained child-scoped. A second isolated container imported packaged
ESM directly and passed public-address policy, immutable DNS snapshot, Push
compatibility, default artwork/CAA proxy refusal, pinned lookup and streaming
checks. Both containers were removed and absence verified.

Private evidence remains under ignored `.tmp/artwork-egress-2026-10-22/`, including
before/after inventories, exact artifact comparison, build, migration, readiness,
Linux checks and retirement records. Controlled destination mapping and packaged
module checks do not establish live DNS/provider acceptance. Readiness establishes
preserved startup; controlled assignment sinks establish ordering, not database
transaction durability. Next, qualify aggregate artwork admission and resource
budgets as described in the [application outcome](ARTWORK_EGRESS_OUTCOME.md).
