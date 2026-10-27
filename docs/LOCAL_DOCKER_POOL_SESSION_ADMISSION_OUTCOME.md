# Local Docker pool/session admission outcome

October 27, 2026. Fresh-builder pull/no-cache candidate:

`sha256:cca7078e92f9534de4f5f3d66d5eff2902a489e01bec1a212f79f33049adaa8d`

Previous qualified image:
`sha256:033aa36b5eda19b183db576600f8288c49b726b82b1bf142c11572238493e2cc`.

## Artifact and walkthrough checks

The runtime has 996 server, 156 client and 13 shared files. Exactly 12 server files
changed; all other server/shared paths, bytes and modes match the prior image.
Client assets are byte-identical and match the local build. All 110 npm and 151
OS package records remain unchanged, with Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9
and undici 7.30.1 unchanged.

The existing walkthrough is healthy on loopback port 47956, UID 1000 and read-only
root. Its administrator and data were preserved. All original read/write binds
match the inspected configuration: `/app/data`, `/data/downloads`, `/data/music`,
`/data/staging`, `/data/transcode-temp`. The actual downloads override was retained.
Startup verified 115 applied and zero pending migrations. Readiness passed; the
fresh builder, bootstrap helper and password-only temporary file retired.

## Qualification

All seven packaged PostgreSQL entries passed: 10 session/pool scenarios, schema
HTTP, 16 drift/lifecycle cases, ordinary observation/backup, six preparation
serialization cases, 17 snapshot transaction cases and 12 CLI reader cases. Each
ran with network none, read-only root, UID 1000, CPU 2, memory/swap 3 GiB and 256
PIDs. Exit zero and exact container absence were verified.

All six mapped native library/binary hashes match the prior runtime. Entrypoint
bytes/mode match source and the previous image. The existing data-bind probe
passed directory creation/sync, publication/readiness, exclusive-link collision
preservation and exact owned-file cleanup. Live migration status/checksums and
both diagnostics CLIs passed; ledger/catalog fingerprints were unchanged.

The live environment resolves a 5000ms checkout timeout and 64 pending checkouts.
The existing administrator logged in and performed one explicit no-store schema
refresh with 164 current anchors. Desktop/mobile screenshots were reviewed with
focus preserved and no overflow. Three separate browser scenarios passed,
including the diagnostic request deadline and explicit retry.

All six separately owned slskd lanes passed; their provider image, credentials,
source captures and evidence limits are recorded in the
[provider outcome](SLSKD_0262_QUALIFICATION_OUTCOME.md). No external account or
operator provider/download configuration was changed.

Packaged source capture (3,697 files):
`09aafb101d095978f45d161aecf9aeaf22856ad669f0c9df1f523ea3d23fe985`.
Final source (3,700 files):
`fea8d22af08874f3bbaa5fed9212c875f95235672335d5582960709b498246c6`.
The intervening changes affect only slskd qualification helpers and their focused
observer test. All 12 changed production files, database/browser tests, package
records and current built client bytes match the qualified image/capture. The
image and successful database/browser lanes were retained after this exact
comparison; the final fast gate and affected provider lanes were rerun. Earlier
18 container-replacement and seven entrypoint-preparation matrices remain retained
after unchanged owning source/test/runtime review, rather than claimed as new runs.

The Windows-hosted auth/CSRF cohort passed six of seven cases; backup export
refused directory fsync with EPERM. This is separate from Linux qualification and
is not reported as a fully passing integration cohort. Existing
[directory-sync scope](BACKUP_DIRECTORY_SYNC_OUTCOME.md) does not establish native
Windows support, and its owning production code is unchanged by this task.

See [Docker design](LOCAL_DOCKER_POOL_SESSION_ADMISSION_DESIGN.md),
[implementation outcome](POOL_SESSION_ADMISSION_OUTCOME.md) and
[provider outcome](SLSKD_0262_QUALIFICATION_OUTCOME.md).
