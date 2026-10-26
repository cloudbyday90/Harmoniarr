# Local Docker migration observation outcome

October 26, 2026. Followed [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md)
using a fresh Docker container builder with --pull --no-cache --load, then Compose
up -d --wait --no-build and the one-shot bootstrap profile. The existing
administrator was recognized; the bootstrap helper and builder were retired.
No reset, release, Git tag or new branch was created.

Image: `sha256:2991edfb93b62c15dce77485d9e062f08a7ada28bfc29162f148a154a3b6eda4`.
Healthy at http://127.0.0.1:47956, Linux amd64, UID 1000, read-only root.
Preserved the administrator, database, provider configuration and all five actual
binds/access modes: /app/data, /data/downloads, /data/music, /data/staging and
/data/transcode-temp. Source paths match the preceding deployment.

Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1 and PostgreSQL 18.6.
Verified 115 applied migrations and zero pending. Source/build inventory matched:
960 server files, 13 shared files and 155 client assets. Only onboarding summary,
backup export, backup restore preview and system routes changed on the server.
All other server files, shared files, client bytes, 110 runtime npm packages,
151 OS packages and six mapped native binary hashes matched the preceding image.
No dependencies changed; runtime npm audit reported zero vulnerabilities.

The readiness-only provider command passed using a temporary password-only file,
which was removed. This is readiness evidence, not a new accepted transfer. The
configured backup-root probe passed directory preparation, same-handle readiness,
exclusive publication, collision preservation, directory sync and deletion cleanup;
its owned files were removed.

The immutable image passed the guarded migration-observation test with actual
HTTP/database/encrypted-file/restore work and a supported-DDL refusal guard. The
normal startup backup-recovery regression also passed with background services
enabled. Both owned native containers were removed and absence verified. Native
modules came from the image without candidate source overlays.

The real packaged onboarding page showed Database migrations are current. Its
administrator response was no-store, Refresh retained focus, no page errors were
observed and desktop/390 px layout checks passed. Screenshots were inspected.
No real backup creation or restore was performed against preserved walkthrough
data; those commands were exercised only in the disposable native fixture.
Manual screen-reader and physical-device checks remain deferred.

The separate Windows-hosted recovery integration failure remains documented in the
[implementation outcome](MIGRATION_OBSERVATION_OUTCOME.md). Directory fsync returned
EPERM there; native Linux checks passed without weakening checkpoint requirements.

See [design](MIGRATION_OBSERVATION_DESIGN.md) and
[research/tradeoffs](MIGRATION_OBSERVATION_RESEARCH.md). Initial preflight and host
failure evidence lives under .tmp/migration-observation-2026-10-26/. Final freeze,
gate, rebuild, runtime, native and browser evidence lives under
.tmp/migration-observation-final-2026-10-26/.
