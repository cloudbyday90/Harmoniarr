# Local Docker startup backup recovery outcome

October 26, 2026. Followed [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md)
for the preserved configured stack. Used a fresh Docker container builder with
`--pull --no-cache --load`, then Compose `up -d --wait --no-build` and the one-shot
bootstrap profile. The bootstrap helper recognized the existing administrator and
was removed. No reset or release was performed.

Image: `sha256:e0ee07ae676f2932e3b68045f5a065160d231ee0a7caa36e3422dd4d16fa6aeb`.
Healthy at `http://127.0.0.1:47956`, Linux amd64, UID 1000, read-only root.
All five actual binds and their access modes were preserved: `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
Preserved the existing administrator, database and configured provider.

Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1, PostgreSQL 18.6;
115 migrations verified with zero pending. Runtime inventory matches the source
and built client: 954 server files, 12 shared files and 155 client assets.
All 110 runtime npm packages, 151 OS packages and six mapped native binary
hashes match the preceding image. There were no dependency changes; npm audit
reported zero vulnerabilities.

The readiness-only provider check passed using a temporary password-only file,
which was removed. It establishes configuration/path readiness, not a new accepted
transfer. The owned real-backup-root probe passed private directory creation,
repeated ancestor checks, same-handle readiness, exclusive publication and deletion
cleanup; its files were removed.

The packaged Recovery panel displayed a completed startup scan with zero unfinished
operations. The actual administrator response used `Cache-Control: no-store` and
safe status fields. Desktop and 390 px browser checks retained refresh focus;
the mobile viewport and panel fit without horizontal overflow. Screenshots were
inspected. Manual screen-reader and physical-device checks remain deferred.

See [implementation and validation](BACKUP_STARTUP_RECOVERY_OUTCOME.md),
[design](BACKUP_STARTUP_RECOVERY_DESIGN.md) and
[research/tradeoffs](BACKUP_STARTUP_RECOVERY_RESEARCH.md). Private rebuild,
inventory, native identity, probe and browser evidence is under
`.tmp/backup-startup-recovery-2026-10-26/`.
