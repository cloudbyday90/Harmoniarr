# Local Docker mixed review/media outcome

October 24, 2026. Followed the maintained
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), preserving the administrator, application
data and all five actual bind mounts. No version or release publication.

## Preserved-state no-cache rebuild

A fresh owned Buildx builder ran `--pull --no-cache --load`, then was removed.
Baseline: `sha256:2390128f3cd63389d4bd189a495c506b09150899705c00a126734e2d1a0df4a4`.
Candidate: `sha256:604411d6612f46bd2ff6092908b066ab06148dfe570310f4a0f4a1a14b4139c4`.

Owned network-disabled inventory containers compared both images and frozen source.
All 933 server, eleven shared and 155 client files are byte-identical to baseline.
The client matches the local build. The package metadata adds only the explicit
native validation alias; dependencies, lockfile, version and engines are unchanged.
Node 24.22.1, npm 12.0.2, the Node binary, 110 production npm and 151 APK packages
match. Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6 remain.

Compose `up -d --wait --no-build` applied zero migrations and verified 115 applied,
zero pending. The app is healthy at `http://127.0.0.1:47956`, Linux amd64, UID 1000,
with read-only root and loopback-only exposure. All five binds, including the actual
downloads directory, match before/after. Bootstrap confirmed the existing admin
and its helper was removed. Authenticated readiness validation passed; the temporary
password-only file and directory were removed. Existing settings/data remain.

## Fresh mixed profiles

The new native entry ran separately in fresh 2 GiB and 3 GiB containers against
the immutable candidate image. Both used two CPUs, 256 PIDs, equal memory/swap caps,
no network or published ports, read-only root and disposable data/database tmpfs.
Source/test mounts were read-only and checked against the frozen qualification
files. PostgreSQL shares the measured process cgroup. Both containers were removed
and absence verified; earlier failed/preliminary containers are also retired.

Each passed real review navigation/checking/restart/queue completion together with
actual scan, probing, null-output encoding, artwork and database work. Eight HTTP
operations completed within scan/encoder lifetime overlap; three qualification
claims completed. Three media leases and the qualification lease released, native
commands closed, artwork reservations settled and original media bytes survived.

V1 approximate lifetime peaks were 1,463.0 MiB and 1,472.4 MiB respectively, with
unchanged failcnt/OOM kills. Kernel lifetime includes all preparation, and these
profiles do not establish a production memory minimum. The
[feature outcome](DEPLOYMENT_REVIEW_MEMORY_OUTCOME.md) owns separate sampled kernel/
process/latency measurements, exact scope and the next entropy-corpus recommendation.

The preceding image's 42 SQL cases, nine browser cases and both maintained
controlled-provider/file-backed validators are retained after exact unchanged
source/test/packaged-runtime comparison. Their owned resources remain absent.
Those matrices were not rerun for this fixture/alias-only change. Current readiness
and the two new packaged profiles are new executions; no live-provider or human
screen-reader/device acceptance is asserted.
