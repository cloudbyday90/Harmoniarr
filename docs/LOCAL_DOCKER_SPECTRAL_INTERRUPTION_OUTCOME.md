# Local Docker spectral interruption outcome

Recorded October 23, 2026 after following the preserved-state
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The separate
[implementation outcome](SPECTRAL_INTERRUPTION_OUTCOME.md) records validation,
resource limits, tradeoffs and the next recommendation.

## Build and preserved state

A fresh owned Buildx builder used `--pull --no-cache --load` to rebuild
`harmoniarr:walkthrough-local`. The builder was removed and absence verified.
The existing service started with `up -d --wait --no-build`.

- Final image: `sha256:d85f94f19ba210b1c578f04a4ed5091c702beca7b60b7964928bfb2c5937608f`.
- Healthy at **http://127.0.0.1:47956**, Linux amd64, UID 1000, read-only root.
- All **five actual bind mounts** match before/after, including the existing
  completed-download override. Administrator and application data were preserved.
  Bootstrap reused the administrator, and its helper was retired.
- Startup applied **zero migrations**, verifying **112 applied and zero pending**.
- The authenticated readiness-only browser command passed without submitting
  search, download or transfer work. Its temporary password-only file outside
  the repository was removed.

## Runtime and qualification

Compared with preceding image
`sha256:04ed04d88d130d45c595dcd768de6266f1334f9eb23504313f8df45524db7373`,
exactly nine reviewed server files changed, including the two new modular spectral
owners. The image has 907 server files, 11 unchanged shared files and 155 unchanged
client artifacts. Remaining server bytes, shared source, root metadata and local
client build comparisons passed.

Node 24.22.1, npm 12.0.2, Node binary hash, all 110 production npm packages and all
151 operating-system package versions remain unchanged. Packaged tools include
Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6. No dependency,
Dockerfile or Compose manifest changed. The package change only adds the explicit
native spectral lane; app version and lockfile are unchanged.

This exact image passed two new spectral native cases, two existing lease native
cases, two command-admission cases and all four shared-container memory scenarios
at both 3 GiB and 2 GiB. Owned native fixtures use private tmpfs/PostgreSQL, without
live database/music/data binds. Every owned test container was removed and absence
verified. The live service remains running and healthy.

The [design](SPECTRAL_INTERRUPTION_DESIGN.md) records reproduction mounts and the
profile guard. Native spectral cancellation waits for decoded metadata; held claim
loss uses the production one-second observation interval. These selected checks
do not establish a deployment minimum, whole-platform cancellation, audio
classification accuracy or atomic reputation delivery. Integration tests separately
use the cached PostgreSQL 18.3 image, not packaged 18.6 evidence.

Private build logs, before/after inventories, source fingerprint, readiness,
native results and retirement records remain in
`.tmp/spectral-interruption-2026-10-23/`. No release or tag is created. Next work is
concurrency-safe spectral backlog/dedup admission with native database proof.
