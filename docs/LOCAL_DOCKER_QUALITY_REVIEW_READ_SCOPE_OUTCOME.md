# Local Docker minimal read scope outcome

October 24, 2026. Followed the maintained
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), preserving the existing administrator,
application data and all five actual bind mounts. No version or release publication.

## Preserved-state rebuild

A fresh owned Buildx builder ran `--pull --no-cache --load`, then was removed.
Baseline: `sha256:1ccb891a4fe3a4d194d846d40963a64fb56544c7a8c4b62a151fbfca248c38d8`.
Candidate: `sha256:2390128f3cd63389d4bd189a495c506b09150899705c00a126734e2d1a0df4a4`.

Owned network-disabled inventory containers compared both images and frozen source
before replacement. Exactly two server files changed; all other packaged server
files match. Counts remain 933 server, 11 shared and 155 client files. Shared files
and client assets are byte-identical to baseline, and the client matches the local
production build. Node 24.22.1, npm 12.0.2, the Node binary, 110 production npm
packages and 151 APK packages match. Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe
8.0.1 and PostgreSQL 18.6 remain unchanged.

Compose `up -d --wait --no-build` applied zero migrations and verified 115 applied,
zero pending. The app is healthy at `http://127.0.0.1:47956`, Linux amd64, UID 1000,
with read-only root and unchanged loopback-only exposure. Before/after comparison
confirms all five binds, including the actual downloads directory. Bootstrap
confirmed the existing administrator; its helper was removed. Authenticated
readiness-only validation passed using a temporary password file outside the
repository; the file and directory were removed. Provider settings/data remain.

## Packaged qualification

The updated shared fact fixture passed on PostgreSQL 18.6 in the immutable image.
Its 27-case full/minimal policy comparison now includes cursor-context digests,
alongside search/progress policy. Five malformed/stale refusals, 2,048 files and
2,048 decisions retain the same outcomes. Serialized results match host PostgreSQL
18.3: at most 921 minimal versus at least 1,188,240 full bytes. Child-lock independence
and retained parent mutation/delete/evidence-FK serialization also passed.

The native container used no network or published ports, read-only root, dropped
capabilities, UID 1000, 2 CPUs, 3 GiB memory/swap and 256 PIDs. Source/test mounts were
read-only and source matched the packaged image. The container was removed and
absence verified. This defines the fixture profile, not an RSS or latency guarantee.

Prior revision, NOWAIT-fence and 224-profile query-plan native component evidence
is retained through the baseline receipt after unchanged component source/test/
schema and packaged runtime comparison. Those three entries and their unchanged
host benchmark cohorts were not rerun for this page-reader wiring change. Current
HTTP paging/restart/selection tests still exercise revision freshness and authority.

Both maintained controlled-provider and file-backed music-queue validators passed
on the immutable candidate image. Their owned projects, containers, volumes,
networks and workspaces were removed and absence checked. These controlled actual
acquisition/preflight/recovery checks preserve walkthrough data and do not assert
new live-provider download acceptance.

The [feature outcome](QUALITY_REVIEW_READ_SCOPE_OUTCOME.md) owns the 11,114-test gate,
42 SQL cases, nine browser cases and practical skill update. No new schema object
or concurrent memory envelope is claimed. Mixed-workload resource qualification
is the next recommendation; human screen-reader/device checks remain deferred.
