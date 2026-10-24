# Local Docker bounded restart qualification outcome

October 24, 2026. Followed the maintained
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), preserving the existing administrator,
application data and all five actual bind mounts. No version, tag or release.

## No-cache preserved-state rebuild

A fresh owned Buildx builder ran `--pull --no-cache --load`, then was removed.
Baseline: `sha256:1653a941d60d9d00a7dc4a1192b15c3b63aca6ced5ea686c871ef36d514b3f91`.
Candidate: `sha256:0be867c731701f7b068d607606f9bb2eb3fea2a3744d281d2a25cff159bc592a`.

Before app replacement, owned network-disabled inventory containers compared both
images and the frozen source. The candidate has 930 server, 11 shared and 155
client files. Twenty expected server files and the shared operation descriptor
changed; all other server/shared files match. The client matches the local build;
55 asset hashes change with the new feedback/descriptor dependency graph. Node
24.22.1, npm 12.0.2, the Node binary, 110 production npm packages and 151 APK
packages match the baseline. Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and
packaged PostgreSQL 18.6 remain unchanged.

Compose `up -d --wait --no-build` applied exactly one additive qualification index
migration and verified 115 applied with zero pending. The app is healthy at
`http://127.0.0.1:47956`, Linux amd64, UID 1000, with read-only root and unchanged
loopback-only exposure. Before/after comparison confirms all five binds, including
the actual configured downloads directory. The bootstrap helper confirmed the
existing administrator and was removed. Authenticated readiness-only validation
passed using a password-only temporary file outside the repository; the file and
directory were removed. Provider settings and existing application data remain.

## Isolated packaged verification

Three native entries ran in separate disposable containers against the immutable
candidate image. Each used no network or published ports, read-only root, dropped
capabilities, UID 1000, 2 CPUs, 3 GiB memory/swap and 256 PIDs with disposable data.

- Candidate revisions passed committed visibility, writer wait, inversion-abort
  and mutation/rollback qualification on PostgreSQL 18.6.
- Restart fences passed both actual contention directions: a revision held by a
  writer waiting for the failed candidate causes NOWAIT refusal; an inserted
  candidate waiting at the trigger commits after the successful fence is released.
- Candidate query plans passed all 224 profiles over 100,000 facts on PostgreSQL
  18.6, retaining the 2,498,560-byte index.

All three containers were removed and absence verified. Source/test mounts were
read-only; only the owned evidence directory was writable. These limits describe
the fixture profile, not a new memory or latency guarantee.

The maintained controlled-provider pipeline and file-backed music-queue recovery
validators passed on the same immutable image. They exercise controlled actual
acquisition, quality recovery/exhaustion/current-authority refusal and authentic /
transcoded preflight behavior. Their owned projects, containers, volumes, networks
and temporary workspaces were removed and absence checked. They neither change
walkthrough data nor establish new public-provider download evidence.

Previous native media allocation evidence is retained for unchanged media/resource
implementation and packaged runtime. New concurrent qualification + media/scan
workload RSS and latency have not been measured. The
[feature outcome](BOUNDED_RESTART_QUALIFICATION_OUTCOME.md) owns the 11,110-test fast
gate, 46 SQL cases, nine browser cases, practical skill update and next fact/lock
reduction recommendation. Manual screen-reader/physical-device checks remain
deferred. No release validation or publication is claimed.
