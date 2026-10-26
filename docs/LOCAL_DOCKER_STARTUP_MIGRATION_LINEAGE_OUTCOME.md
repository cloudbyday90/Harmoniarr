# Local Docker startup migration lineage: outcome

Date: October 26, 2026. Followed the preserved-state
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See the separate
[implementation outcome](STARTUP_MIGRATION_LINEAGE_OUTCOME.md),
[design](STARTUP_MIGRATION_LINEAGE_DESIGN.md) and
[research](STARTUP_MIGRATION_LINEAGE_RESEARCH.md).

## Packaged deployment

Final immutable image:
`sha256:2c05e26da9af3b704951e48fb3d71f021cba9f226e1ee522dfece5b7282f47be`.

A fresh Docker-container builder ran `buildx build --pull --no-cache --load`, then
was removed with absence verified. Compose recreated the walkthrough application
using `up -d --wait --no-build`; the existing administrator remained intact through
the normal one-shot bootstrap route. The helper retired and its temporary
readiness-check password file was removed. Readiness-only validation passed.

| Check | Result |
| --- | --- |
| Address | http://127.0.0.1:47956, healthy |
| Runtime | Linux amd64, UID 1000, read-only root; Node 24.22.1 and npm 12.0.2 |
| Database | PostgreSQL 18.6; 115 applied migrations, zero pending, zero newly applied |
| Preserved writable bind destinations | /app/data, /data/downloads, /data/music, /data/staging, /data/transcode-temp |
| Inventory | 964 server, 156 client, 13 shared files |
| Dependencies | 110 runtime npm and 151 OS packages, unchanged |

Before/after bind descriptors matched exactly; existing data and administrator
were preserved without reset. Comparison against the preceding committed image
`sha256:95230309d735d9ecf955216f86a1b020accf878bd42a03a584efbcc3c8b1521a`
matched frozen source hashes for only the three expected server changes: the
full-state report, new startup assertion service and startup composition boundary.
Other server/shared files, client bytes, root metadata, dependency inventories,
Node binary, OpenSSL 3.5.9 and undici 7.30.1 matched preceding evidence.

The preserved deployment passed the stronger default application startup after
its existing preparation phase. No fixture fault, role edit, history repair or
backup restore was applied to that deployment. Qualification containers use
isolated data; they do not add another application service.

## Native qualification

The final immutable image passed the CLI lineage fault, HTTP/backup observation
and startup/recovery entries without overlays replacing packaged production code.
Each entry used an admitted disposable tmpfs database, network none, read-only root,
UID 1000, 3 GiB memory/swap, two CPUs and 256 PIDs. Twelve diagnostic cohorts and
six direct application startup refusals preserved ledger/catalog identity; normal
prepared startup and actual backup restore/recovery remained functional. These
direct-node refusal cases do not imply a new pre-preparation entrypoint guard.

Six mapped native binary hashes matched preceding qualification. The configured
backup-root probe verified private directory creation, file readiness, exclusive
publication, directory sync, collision preservation, deletion and removal of its
owned files. All three native test containers retired with absence verified.

The live packaged status, checksum and diagnose commands all passed. Complete
ledger hashes and UUID function OID/xmin/definition hashes matched before/after,
with 115 applied rows and a current full-state report. No live role or schema
fault was used for that check.

The full final-image container replacement matrix passed all 18 publication/deletion
checkpoints across 19 production-entrypoint containers. Actual SQL rollback waits
and lost acknowledgements were followed by SIGKILL 137 without OOM, same-volume WAL
redo, schema/HTTP-ready startup, automatic/repeated recovery and fresh bytes/catalog
verification. The stronger lineage guard ran during each normal application
startup, with background services enabled. Every probe/container and the owned test
volume retired with absence verified. Power loss was not tested.

Private logs, source fingerprints, build/runtime inventories, bind descriptors,
readiness evidence, native results and retirement records are retained under
`.tmp/startup-migration-lineage-2026-10-26/`.

No release, tag, new branch or PR merge is part of this change.
