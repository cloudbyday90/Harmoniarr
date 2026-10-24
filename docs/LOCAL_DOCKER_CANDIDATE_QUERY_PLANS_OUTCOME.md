# Local Docker candidate-query rebuild: outcome

Executed October 24, 2026 following the preserved-state path in the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The [feature outcome](CANDIDATE_QUERY_PLANS_OUTCOME.md)
owns behavior, research, measured plans and the next recommendation.

## Build and preserved upgrade

A fresh temporary Buildx builder ran `--pull --no-cache --load`, then was removed
and confirmed absent. Qualified immutable image:

`sha256:7cc9f1ea0f37015c8c26d1c046adbcf4dccdd20c156cbaddb059e86e832c3ed4`

Source/runtime comparison completed before the live restart. The 923 server,
11 shared and 155 client files match the intended source/local build. Exactly
four server files changed: candidate store, additive migration, schema anchor
and generated snapshot. All other server/shared files and all client assets match
the previous image byte-for-byte. Root manifests, Node binary, npm 12.0.2,
110 production npm packages and 151 APK packages match the previous runtime.
Node remains 24.22.1 with the same Sharp/libvips, FFmpeg/FFprobe and PostgreSQL.

Compose restarted with `--wait --no-build` and the actual existing downloads
override. Existing administrator/data and all five actual bind mounts/read-write
settings were preserved. Bootstrap confirmed the existing account and retired its
one-shot helper. Database preparation applied **one migration**, verified **113
applied / zero pending**, and retained existing data.

The deployment is healthy, Linux amd64 UID 1000, with a read-only root and only
`127.0.0.1:47956` published. Authenticated readiness-only verification passed; its
password-only temporary file was outside the repository and removed afterward.
No live provider transfer, reset, version bump, Git tag or release was requested.

## Packaged PostgreSQL plans

The maintained native entry passed the existing explicit disposable deployment
guard before acquiring a pool or dropping the fixture index. It ran the same
100,000-row / 224-profile matrix on packaged **PostgreSQL 18.6** with network
disabled, no published ports, UID 1000, read-only root, tmpfs app/database data and
the existing two-CPU/three-GiB profile. Only generated evidence had a separate owned
output bind. It qualifies query behavior under those controls, not memory sizing.

The scoped range, exact ordered-ID, custom/generic, read/locking and EOF assertions
passed. The controlled index is 2,498,560 bytes, and the sparse custom first page
examines fifty rows with 54 root buffer accesses. Dense custom first pages retain
the measured primary-key choice. The final native container was removed and
confirmed absent; local generated proof artifacts remain under ignored `.tmp`.

The initial run passed its database assertions but the collector could not copy
evidence from a stopped tmpfs. The final run used the owned evidence output bind.
No production source or qualification assertion changed for that correction.

## Packaged application/media regressions

Both isolated verifiers passed against the same immutable image:

- Controlled-provider pipeline: seventeen catalogue fixtures, successful actual
  download/apply, durable initial quality refusal, separate successful recovery
  and exhausted-quality review. Missing/disabled owner and revoked monitoring
  each refuse application with zero additional provider transfers and unchanged
  library files.
- File-backed music queue: authentic FLAC reaches applied state through mapping
  recovery; the transcoded source remains failed in durable preflight review.
  Existing collision/strict-quality and actual packaged-media checks pass.

Both projects retired their containers, volumes, networks and temporary data
workspaces. Inventory containers, builder, bootstrap helper and both native-plan
containers were removed and confirmed absent. Generated local proof artifacts are
retained under ignored `.tmp`; no live provider account/library workload is claimed.

## Boundaries

Exact source/runtime comparison retains prior qualification for unchanged native
workers, memory admission and client behavior. These plan observations are not
wall-clock, physical-work maximum, RSS, whole-container memory or public-provider
claims. The complete fresh restart guard still has separate traversal/lock costs;
manual screen-reader and physical-device acceptance remain deferred.
