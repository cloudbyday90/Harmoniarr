# Local Docker migration CLI readers: outcome

Date: October 26, 2026. Followed the preserved-state
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Application behavior and validation
are recorded separately in the [implementation outcome](MIGRATION_CLI_READERS_OUTCOME.md).

## Final deployment

Final immutable image:
`sha256:95230309d735d9ecf955216f86a1b020accf878bd42a03a584efbcc3c8b1521a`.

A fresh Docker-container builder ran `buildx build --pull --no-cache --load`,
then was removed. Compose recreated only the walkthrough application with
`up -d --wait --no-build`. The existing administrator was retained through the
one-shot bootstrap route; the helper retired without resetting the database.
Readiness-only provider validation passed, and its temporary password file was
removed. No release, tag or new branch was created.

| Check | Result |
| --- | --- |
| Local address | http://127.0.0.1:47956, healthy |
| Runtime | Node 24.22.1, npm 12.0.2, Linux amd64, UID 1000, read-only root |
| PostgreSQL | 18.6; 115 applied migrations, zero pending, zero newly applied |
| Preserved writable binds | /app/data, /data/downloads, /data/music, /data/staging, /data/transcode-temp |
| Runtime inventory | 963 server, 156 client and 13 shared files |
| Dependencies | 110 runtime npm and 151 OS packages; unchanged |
| Native identity | Six mapped native binary hashes matched preceding qualification |

Before/after bind descriptors matched exactly. Source and build hashes matched
the packaged image. Comparison against the preceding committed deployment image
`sha256:d232a99c63f8669a3c701befe1856dc16ede81ffb62977f22f4b916df027d389`
found only the eight expected server changes: two CLI import updates, packaged
diagnose, checksum service, migration compatibility exports, full-state observer,
status observer and store. Other server/shared files, client bytes, root metadata,
runtime dependencies, Node binary, OpenSSL 3.5.9 and undici 7.30.1 matched.

## Packaged checks and retirement

The immutable final image passed the migration CLI, HTTP/backup observation and
startup/recovery native entries without production-code overlays. Each admitted
container used an isolated prepared PostgreSQL cluster, network none, read-only
root, UID 1000, 3 GiB memory/swap, two CPUs and a 256 PID limit. These were temporary
qualification containers, not an additional application service.

The final image passed the full 18-checkpoint container replacement matrix across
19 production-entrypoint containers with background services enabled. Actual SQL
rollback waits and lost acknowledgements were followed by SIGKILL 137 without OOM,
same-volume WAL redo, healthy replacement startup, automatic recovery, fresh
bytes/catalog verification and repeated recovery. All probes, containers and the
owned test volume were removed and absence verified. This did not test power loss.

The actual configured backup-root probe verified private directory creation,
file readiness, exclusive publication, directory sync, collision preservation,
deletion and owned-probe removal. It did not reset application data or restore a
backup into the preserved deployment. Native database faults and fixture roles
were restricted to isolated containers.

On the preserved live deployment, all three packaged diagnostic commands passed.
Complete ledger-row hashes and UUID function OID/xmin/definition hashes matched
before/after; 115 applied rows remained current. This supplements the restricted
role fault qualification without introducing live schema or privilege changes.

Private evidence is retained under
`.tmp/migration-cli-readers-package-2026-10-26/`, including source fingerprints,
full-gate logs, the verified trailing-whitespace-only equivalence record, build,
runtime inventory/comparison, native results, bind descriptors and retirement.
