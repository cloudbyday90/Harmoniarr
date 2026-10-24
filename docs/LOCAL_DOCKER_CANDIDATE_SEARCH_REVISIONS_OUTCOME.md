# Local Docker candidate revision outcome

October 24, 2026. Followed [the maintained walkthrough](LOCAL_DOCKER_WALKTHROUGH.md)
using its existing Compose deployment, administrator and all five actual bind
mounts. This is local validation; no version, tag or release was created.

## Preserved-state rebuild

A newly created owned Buildx builder ran `--pull --no-cache --load` for the local
walkthrough image and was removed after completion. Baseline image:
`sha256:7cc9f1ea0f37015c8c26d1c046adbcf4dccdd20c156cbaddb059e86e832c3ed4`.
Candidate image:
`sha256:1653a941d60d9d00a7dc4a1192b15c3b63aca6ced5ea686c871ef36d514b3f91`.

Before replacing the app, owned network-disabled inventory containers compared
packaged contents to the frozen source and prior image. Seven expected server
files changed: scope/page/cursor policy, revision store, additive migration,
schema anchors and snapshot. All other server/shared contents match. Inventory:
925 server files, 11 shared files and 155 client files. Client assets are byte
identical to the previous image and match the local production build.

Node 24.22.1, npm 12.0.2, the Node binary, 110 production npm packages and 151 APK
packages match the baseline. Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and
packaged PostgreSQL 18.6 remain unchanged. Existing native media/memory evidence is
retained only for unchanged implementation/runtime paths; this work makes no new
allocation, RSS, latency or whole-platform performance claim.

Compose startup used `up -d --wait --no-build`. The database applied exactly one
revision migration and verified 114 applied with zero pending. The app is healthy
at `http://127.0.0.1:47956`, Linux amd64, UID 1000, with a read-only root filesystem.
Before/after mount comparison proves all five binds unchanged, including the
actual configured downloads directory. The bootstrap helper confirmed the existing
administrator and was removed. Authenticated readiness-only provider validation
passed using a password-only temporary file outside the repository; that file and
directory were removed. Existing provider settings and application data remain.

## Isolated packaged qualification

The guarded native entries ran on the exact candidate image with disposable
PostgreSQL data, no network, no published ports, read-only root, dropped
capabilities, UID 1000, 2 CPUs, a 3 GiB hard memory/swap limit and 256 PIDs. Two
tests passed on PostgreSQL 18.6: shared revision mutation/rollback, actual writer
wait and inversion-abort evidence; and all 224 candidate query-plan profiles over
100,000 facts. The index remains 2,498,560 bytes. Limits describe this fixture;
they do not constitute a new deployment memory qualification. The container was
removed and absence verified. Source/test mounts were read-only; only the owned
evidence output directory was writable.

Both maintained media validators passed against that immutable image: the
controlled-provider pipeline and file-backed music-queue recovery. These use
owned fixtures rather than public provider discovery. The pipeline exercised
actual acquisition, quality recovery/exhaustion and current-authority refusals;
file-backed proof retained authentic acceptance and transcoded refusal. Validator
projects, containers, volumes, networks and temporary workspaces were removed and
their absence checked. No fixture state was applied to the walkthrough database.

The [feature outcome](CANDIDATE_SEARCH_REVISIONS_OUTCOME.md) owns focused, broad,
SQL, browser, standards-skill evidence and the next bounded-command recommendation.
Real screen-reader and physical-device acceptance remain deferred. The working
deployment retains its current provider readiness; isolated fixture success does
not claim a new live-provider download or release qualification.
