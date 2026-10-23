# Local Docker durable media cancellation outcome

Recorded October 23, 2026 after following the preserved-state
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See the separate
[implementation outcome](MEDIA_WORKER_CANCELLATION_OUTCOME.md) for tests,
memory measurements, limits and the next recommendation.

## Build and preserved deployment

Rebuilt `harmoniarr:walkthrough-local` using a fresh owned Buildx builder with
`--pull --no-cache --load`. The builder was removed and its absence verified.
Started the existing Compose service with `up -d --wait --no-build`.

- Final image:
  `sha256:959bf438bf6babed7eb9d333a53ceff7ddbc39808c003edc76b7799ced23170d`.
- Healthy at **http://127.0.0.1:47956**; Linux amd64, UID 1000, read-only root.
- All **five actual bind mounts** matched before/after, including the existing
  completed-download override. Existing administrator and application data were
  preserved. Bootstrap reused the administrator, and its helper was retired.
- Startup applied **zero migrations** and verified **112 applied, zero pending**.
- The walkthrough's authenticated, readiness-only browser command passed. No
  search, download or transfer was submitted by that check. The temporary
  password-only file outside the repository was removed.

## Runtime and native evidence

Compared the image to the preceding shared-admission image
`sha256:2cf5917edef018c3b4629b39d9ce7427a2bc5b84a4817515e003c294f4e3ad36`.
Exactly the ten reviewed cancellation-related server files changed. The image
contains 905 server files, 11 unchanged shared files and 155 unchanged client
artifacts; remaining server bytes match the preceding image. Runtime source,
shared files, root metadata and local client build comparisons passed.

Node 24.22.1, npm 12.0.2, the Node binary hash, all 110 production npm packages
and all 151 operating-system package versions remain unchanged. Packaged tooling
includes Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6.
No dependency, Dockerfile or Compose manifest changed. The package script change
only adds the explicit native cancellation lane.

Disposable, owned containers on this exact image passed two native cancellation
cases, two existing command-admission cases and all four memory cases at both
3 GiB and 2 GiB. Native fixtures used private tmpfs storage and disposable
PostgreSQL, not the live database or music/data mounts. Every owned test container,
including the initial launcher failure, was removed and absence verified. The
live application remains running and healthy.

The new native lane is reproduced with the mounts and guard described in the
[cancellation design](MEDIA_WORKER_CANCELLATION_DESIGN.md). Readiness cancellation
uses the production polling interval; actual encoding interruption uses a declared
25 ms test interval. These results do not establish cancellation latency or a
deployment memory minimum. The PostgreSQL integration lane separately uses its
existing 18.3 fixture; it is not reported as packaged 18.6 evidence.

Private build logs, inventories, source fingerprints, readiness result, native
results and retirement records remain in
`.tmp/media-worker-cancellation-2026-10-23/`. App version and lockfile are unchanged;
no release or tag is created. The next implementation item is lease-loss-triggered
media interruption with retained close and persistence ownership.
