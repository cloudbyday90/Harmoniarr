# Local Docker onboarding migration state outcome

October 26, 2026. Followed [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md)
using a fresh container builder with --pull --no-cache --load, then Compose
up -d --wait --no-build and the one-shot bootstrap profile. The existing
administrator was recognized; the bootstrap helper and builder were retired.
No reset, release, Git tag or new branch was created.

Image: `sha256:d232a99c63f8669a3c701befe1856dc16ede81ffb62977f22f4b916df027d389`.
Healthy at http://127.0.0.1:47956, Linux amd64, UID 1000, read-only root.
Preserved the administrator, database, provider configuration and all five actual
binds/access modes: /app/data, /data/downloads, /data/music, /data/staging and
/data/transcode-temp. Actual host mount sources match the preceding deployment.

Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1 and PostgreSQL 18.6.
Verified 115 applied migrations and zero pending. Source/build inventory matched:
961 server files, 13 shared files and 156 client assets. Only the new migration-step
projector and onboarding summary changed on the server. Rebuilt client assets match
the local build. Other server/shared files, 110 runtime npm packages, 151 OS packages
and six mapped native binary hashes matched the preceding image. No dependencies
changed; runtime npm audit reported zero vulnerabilities.

The readiness-only provider command passed using a temporary password-only file,
which was removed. This establishes readiness rather than a new accepted transfer.
The configured backup-root probe passed directory creation, repeated ancestor checks,
same-handle readiness, exclusive publication, collision preservation, directory sync
and deletion cleanup. All of its owned files were removed.

The immutable image passed real unavailable-migration projection under the existing
DDL refusal guard, plus read-only/concurrent/authorization/encrypted-backup/restore
controls. The normal startup recovery regression also passed with background
services enabled. Both owned native containers were removed and absence verified;
server modules came from the image without candidate overlays.

The packaged page delivered the actual current database step and no-store. Separate
controlled unavailable/error replies exercised the updated panel, retained checklist,
fixed error copy and stable status region. Refresh focus and a 390 px width check
passed, no page errors occurred and screenshots were inspected. No schema fault or
backup mutation was injected into the preserved deployment. Manual screen-reader
and physical-device checks remain deferred.

The complete stable gate passed 6,134 server, 4,497 client and 700 script tests plus
the required static/build checks. Two real-browser scenarios passed from the final
candidate. See [implementation outcome](ONBOARDING_MIGRATION_STATE_OUTCOME.md),
[design](ONBOARDING_MIGRATION_STATE_DESIGN.md) and
[research/tradeoffs](ONBOARDING_MIGRATION_STATE_RESEARCH.md). Private source freeze,
gate, rebuild, native, browser and retirement evidence lives under
.tmp/onboarding-migration-state-2026-10-26/.
