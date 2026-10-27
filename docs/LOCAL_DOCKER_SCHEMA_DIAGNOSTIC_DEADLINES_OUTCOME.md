# Local Docker schema diagnostic deadline outcome

October 27, 2026. Fresh-builder pull/no-cache candidate:

`sha256:033aa36b5eda19b183db576600f8288c49b726b82b1bf142c11572238493e2cc`

Replaces the prior schema diagnostics UI image
`sha256:4d5147e24382811bf606af94563a81ceff11825341b3b322d617c7ae4ad9bbe1`.

## Runtime comparison and preservation

The immutable runtime has 990 server, 156 client and 13 shared files. Exactly six
server files changed, including the two new ownership modules; all other server
and shared bytes/modes match the previous image. Rebuilt client bytes match the
local build. All 110 npm and 151 OS package records are unchanged. Node 24.22.1,
npm 12.0.2, OpenSSL 3.5.9 and undici 7.30.1 remain unchanged.

The existing walkthrough is healthy at `http://127.0.0.1:47956`, with read-only
root and UID 1000. Its existing administrator and all five original read/write
bind destinations were preserved: `/app/data`, `/data/downloads`, `/data/music`,
`/data/staging`, `/data/transcode-temp`. The inspected downloads override was
carried into recreation. Startup verified 115 applied and zero pending migrations.
Readiness passed; the bootstrap helper, temporary password and builder retired.

## Qualification

Four packaged PostgreSQL fixture entries passed on the immutable image:
administrator HTTP diagnostics, 16 drift/lifecycle scenarios, ordinary
observation/backup and six preparation-serialization scenarios. Each ran with no
network, read-only root, UID 1000, CPU 2, memory/swap 3 GiB and 256 PIDs; exit zero
and exact container absence were verified. Owned databases/roles and cooperative
preparation locks retired.

All six loaded native library/binary hashes match the earlier qualified runtime.
Entrypoint bytes/mode match source and the previous image. The existing data-bind
backup probe verified private directory creation, file publication/readiness,
exclusive-link collision preservation and owned-file cleanup. It did not reset
the application data.

Live migration status, checksums, migration diagnostics and schema diagnostics all
passed: 115 applied migrations and 164 current anchors. Ledger/catalog fingerprints
were unchanged by the reads. The existing administrator logged in through the
real browser, made one explicit no-store schema refresh and retained focus;
desktop/mobile current screenshots show no overflow. Three separate browser
fixture scenarios also passed, including deadline expiry and explicit retry.

The selected PR #58 fixture image was pulled and run separately as Node 26.12.1:
`sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797`.
Health and authenticated response passed; missing-key access was refused. The
owned container and temporary fixture key retired, with no published port.

Retained rather than rerun: the previous 17 atomic-snapshot, 18 replacement and
seven entrypoint-preparation cases after exact owning source/test/artifact and
packaged runtime comparison. They are distinct from the newly executed lanes.
Source provenance, fast-gate counts and limitations are recorded in the
[implementation outcome](SCHEMA_DIAGNOSTIC_DEADLINES_OUTCOME.md).

## Scope

The 20-second inspection/25-second browser bounds remain subject to event-loop
and OS scheduling. The separately owned diagnostic connection does not bound
ordinary application pool/session admission. No minimum host resource capacity,
distributed quota, remote network-failure SLA or manual screen-reader speech
acceptance is established by these local checks.

See [Docker design](LOCAL_DOCKER_SCHEMA_DIAGNOSTIC_DEADLINES_DESIGN.md),
[implementation outcome](SCHEMA_DIAGNOSTIC_DEADLINES_OUTCOME.md) and
[official research](SCHEMA_DIAGNOSTIC_DEADLINES_RESEARCH.md).
