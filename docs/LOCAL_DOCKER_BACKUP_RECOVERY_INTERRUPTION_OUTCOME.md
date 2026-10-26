# Local Docker recovery interruption outcome

October 26, 2026. Followed [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md)
with a fresh Docker container builder and `--pull --no-cache --load`, followed by
Compose `up -d --wait --no-build` and the one-shot bootstrap profile. The existing
administrator was recognized; the bootstrap helper and builder were retired.
No reset, release, Git tag or new branch was created.

Image: `sha256:67a0ce3c026051a5cbabc25000a4850e7c681ef5892a4540b235769dea006812`.
Healthy at `http://127.0.0.1:47956`, Linux amd64, UID 1000, read-only root.
Preserved the administrator, database, provider configuration and all five actual
binds/access modes: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`,
`/data/transcode-temp`.

Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1 and PostgreSQL 18.6.
Verified 115 applied migrations and zero pending. Source/build inventory matched:
955 server files, 12 shared files, 155 client assets. Only the recovery worker,
status module and new progress policy changed on the server. All other server
files, shared files, 110 runtime npm packages, 151 OS packages and six mapped
native binary hashes match the preceding image. npm audit reported zero
vulnerabilities; no dependencies changed.

The readiness-only provider check passed using a temporary password-only file,
which was removed. This establishes readiness, not a new accepted transfer.
The real configured backup-root probe passed private directory creation, repeated
ancestor checks, same-handle readiness, exclusive publication and deletion cleanup;
its owned files were removed.

The packaged Recovery panel showed its real completed startup status with zero
unfinished operations. The administrator response retained no-store and safe
status fields. A separate controlled response exercised the replay caveat in the
same packaged client. Refresh focus was retained, desktop/390 px layout checks
passed, and screenshots were inspected. These controls did not mutate real
recovery state. Manual screen-reader and physical-device checks remain deferred.

See [qualification outcome](BACKUP_RECOVERY_INTERRUPTION_OUTCOME.md),
[design](BACKUP_RECOVERY_INTERRUPTION_DESIGN.md) and
[research/tradeoffs](BACKUP_RECOVERY_INTERRUPTION_RESEARCH.md). Private rebuild,
inventory, native, browser and retirement evidence lives under
`.tmp/backup-recovery-interruption-2026-10-26/`.
