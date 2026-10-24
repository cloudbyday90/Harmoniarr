# Local Docker mixed corpus outcome

October 24, 2026. Followed the maintained
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), preserving administrator, application
data and all five actual bind mounts. No version, tag or release publication.

## Preserved-state no-cache rebuild

A fresh owned Buildx builder ran `--pull --no-cache --load`, then was removed.
Baseline: `sha256:604411d6612f46bd2ff6092908b066ab06148dfe570310f4a0f4a1a14b4139c4`.
Candidate: `sha256:7e406c535cd2e1ba4d8cce150e6fd662b4bb40de105ddba5e0f131f164c33122`.

Owned inventory containers compared both images and frozen source before replacement.
All 933 server, eleven shared and 155 client files match baseline byte-for-byte;
the client matches the local build. Root package metadata adds only the explicit
native corpus alias. Dependencies, lockfile, version and engines are unchanged.
Node 24.22.1, npm 12.0.2, the Node binary, 110 production npm and 151 APK packages
match. Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6 remain.

Compose `up -d --wait --no-build` applied zero migrations and verified 115 applied,
zero pending. The app is healthy at `http://127.0.0.1:47956`, Linux amd64, UID 1000,
with read-only root and loopback-only exposure. Before/after comparison confirms
all five mounts, including the actual downloads directory. Bootstrap confirmed
the existing administrator; its helper was removed. Authenticated readiness
passed, and its temporary password-only file/directory were removed. Settings/data
remain preserved.

## Isolated packaged matrix

The final immutable image passed eighteen native tests in sixteen fresh containers:
the three default memory cases, one baseline mixed-review case and seven corpus
cases at each 2/3 GiB cap. Cases ran sequentially, with fresh database/data and
source/test mounts read-only. Each used two CPUs, 256 PIDs, equal memory/swap caps,
no network/published ports, read-only root and disposable tmpfs storage.

Accepted corpus cases preserved the canonical output and source/stored hashes.
The large RGBA16 case produced owned 503 capacity refusal for both jobs, no
publication and actual child retirement at each cap. Review/media work, leases,
reservations and original media hashes still completed normally. No limit-hit or
OOM-kill increase occurred. Every final and preliminary native container was removed
and absence verified; the inventory containers and builder also retired.

The [feature outcome](DEPLOYMENT_REVIEW_CORPUS_OUTCOME.md) records per-case v1
approximate lifetime peaks, separate metric meanings, the 11,120-test gate,
seventeen focused checks and coverage limits. No production memory minimum is
inferred from this selected corpus.

The preceding 42 SQL cases, nine browser cases and maintained controlled-provider/
file-backed evidence are retained through unchanged source/test/runtime and receipt
comparison. Those unrelated matrices were not rerun. Their owned resources remain
absent. Current readiness and the eighteen native cases are new executions; no new
live-provider or human assistive-device acceptance is asserted.
