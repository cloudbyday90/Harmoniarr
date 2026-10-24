# Local Docker minimal qualification facts outcome

October 24, 2026. Followed the maintained
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), preserving the existing administrator,
application data and all five actual bind mounts. No version, release or new tag
publication.

## Preserved-state no-cache rebuild

A fresh owned Buildx builder ran `--pull --no-cache --load`, then was removed.
Baseline: `sha256:0be867c731701f7b068d607606f9bb2eb3fea2a3744d281d2a25cff159bc592a`.
Candidate: `sha256:1ccb891a4fe3a4d194d846d40963a64fb56544c7a8c4b62a151fbfca248c38d8`.

Before replacement, owned network-disabled inventory containers compared both
images with frozen source. The candidate has 933 server, 11 shared and 155 client
files. Exactly five server files changed, including three new modules; all other
server/shared files match. Shared files and client assets are byte-identical to
baseline; the client matches the local production build. Node 24.22.1, npm 12.0.2,
the Node binary, 110 production npm packages and 151 APK packages match. Sharp
0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6 remain unchanged.

Compose `up -d --wait --no-build` applied zero migrations and verified 115 applied
with zero pending. The app is healthy at `http://127.0.0.1:47956`, Linux amd64,
UID 1000, with read-only root and unchanged loopback-only exposure. Before/after
comparison confirms all five binds, including the actual downloads directory.
Bootstrap confirmed the existing administrator and its helper was removed.
Authenticated readiness-only validation passed using a temporary password file
outside the repository; its file and directory were removed. Provider settings
and existing data remain preserved.

## Isolated packaged proof

The new native fact/lock fixture passed on the immutable candidate image with
PostgreSQL 18.6. It compares 27 full/minimal policy, requirement and progress-digest
cases, five explicit malformed/stale refusals, 2,048 files and 2,048 decisions.
Serialized bytes match host results: at most 921 minimal versus at least 1,188,240
full. Actual child-lock independence, the old path's child wait and retained parent
mutation/delete/evidence-FK serialization all passed.

This disposable container had no network or published ports, read-only root,
dropped capabilities, UID 1000, 2 CPUs, 3 GiB memory/swap and 256 PIDs. Source/test
mounts were read-only and verified against packaged source; only the owned proof
directory was writable. The container was removed and absence verified. These
limits define the fixture profile, not a deployment memory guarantee.

Prior packaged revision, NOWAIT-fence and 224-profile query-plan component evidence
is retained from the baseline image after exact unchanged source/test/schema and
packaged runtime comparison. The current host SQL cohort reran their integration
behavior with the new composition. These are retained component results, not new
native executions of those three entries.

Both maintained controlled-provider and file-backed music-queue validators passed
on the new immutable image. Their owned projects, containers, volumes, networks
and temporary workspaces were removed and absence checked. They exercise actual
controlled acquisition and quality recovery/current-authority/preflight behavior,
without changing walkthrough data or asserting new live-provider acceptance.

Unchanged media/resource implementation and runtime retain prior native allocation
evidence. Mixed qualification/media/scan RSS and latency were not measured. The
[implementation outcome](QUALIFICATION_CANDIDATE_FACTS_OUTCOME.md) owns the 11,113-
test gate, forty SQL cases, nine browser cases, updated skill and next read-only
scope recommendation. Manual screen-reader/device checks remain deferred.
