# Local Docker backup SQL interruption outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [qualification outcome](BACKUP_SQL_CRASH_OUTCOME.md),
[design](BACKUP_SQL_CRASH_DESIGN.md) and [research](BACKUP_SQL_CRASH_RESEARCH.md).

Final image, built using a fresh disposable BuildKit builder with
`--pull --no-cache --load`:

`sha256:a2a126b96bf755e2caee9f1ad1f6a378ca817a196c8906bf71b29d238e4e1630`

Baseline:

`sha256:69ae2df531ec2fb04541b60f81160e373a057bcf97c2ab18b820afdb06aba421`

All runtime content matches baseline: 948 server modules, 12 shared modules,
155 client entries, 110 runtime npm versions/metadata, 151 APK packages, Node
binary/version metadata and six actually mapped native binary hashes. Root
package metadata and lockfile are unchanged. Test-only ESM modules introduce no
deployed application, proxy or fault endpoint.

Compose ran `up -d --wait --no-build`, followed by the disposable bootstrap,
which recognized the existing administrator. Authenticated provider/path-mapping
readiness passes; temporary password material outside the repository was removed.
The app is healthy at `http://127.0.0.1:47956` with loopback-only publication,
read-only root and UID 1000. Existing data and administrator were preserved.

All five actual bind sources/access modes remain unchanged: `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging` and `/data/transcode-temp`.
Startup verifies 115 applied migrations, zero newly applied and zero pending.
Runtime remains Linux amd64, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

The new SQL native entry passes 18 cases on this immutable image. The preceding
process-crash entry passes all 19 checkpoints again after the shared runner
change. Each entry runs in a fresh networkless/read-only two-CPU/3 GiB container
with tmpfs PostgreSQL/file storage and real packaged child modules. Independent
SQL/file observation verifies rollback or committed response loss, owned Node
SIGKILL/close, session retirement and fresh default recovery. The owning outcome
distinguishes explicit server cancellation from process death, retained old
connections from retired ownership and failed fixture preflights from passing runs.

The actual backup-bind probe passes cold private directory creation, repeated
existing-chain checkpoints, file readiness, exclusive links, inode cleanup,
collision preservation and publication/deletion directory sync. It removes its
owned files without live backup catalog rows. This probe is separate from the
crash matrices' tmpfs storage and does not establish power-loss safety.

Earlier backup, SQL, router, parser and media evidence is retained only through
exact source/runtime comparison; it is not described as rerun. The configured
walkthrough was not reset for an unconfigured-provider smoke. Readiness submits
no transfer command and does not claim download/import acceptance. Optional
managed-provider and release paths remain separate, unchanged evidence.

Builder, bootstrap, inventory/identity and native helper containers retire with
absence checks. Owned producer/recovery processes close before fixture removal.
No new branch, release or provider PR merge was made. Private evidence/audit:
`.tmp/backup-sql-crash-2026-10-26/`.
