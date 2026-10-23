# Local Docker media lease interruption outcome

Recorded October 23, 2026 after the preserved-state
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See the separate
[implementation outcome](MEDIA_LEASE_INTERRUPTION_OUTCOME.md) for executed tests,
memory scope, tradeoffs and the next recommended item.

## Build and preservation

Rebuilt `harmoniarr:walkthrough-local` using a fresh owned Buildx builder and
`--pull --no-cache --load`. Removed the builder and verified its absence. Started
the existing Compose service with `up -d --wait --no-build`.

- Final image: `sha256:04ed04d88d130d45c595dcd768de6266f1334f9eb23504313f8df45524db7373`.
- Healthy at **http://127.0.0.1:47956**; Linux amd64, UID 1000, read-only root.
- All **five actual bind mounts** match before/after, including the existing
  completed-download override. Existing administrator and application data were
  preserved. Bootstrap reused the administrator; its helper was retired.
- Startup applied **zero migrations**, verifying **112 applied and zero pending**.
- The authenticated readiness-only browser command passed, without submitting
  search, download or transfer work. The temporary password-only file outside the
  repository was removed.

## Runtime and native comparison

The prior image was
`sha256:959bf438bf6babed7eb9d333a53ceff7ddbc39808c003edc76b7799ced23170d`.
Exactly five reviewed server files changed: heartbeat, lease error, interruption
scope and the two media workers. The image retains 905 server files, 11 unchanged
shared files and 155 unchanged client artifacts. Remaining server bytes, local
client build, shared source and root metadata comparisons passed.

Node 24.22.1, npm 12.0.2, Node binary hash, all 110 production npm packages and all
151 operating-system package versions remain unchanged. Packaged tooling includes
Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6. No dependency,
Dockerfile or Compose manifest changed. The package change only adds an explicit
native lease-interruption lane; app version and lockfile are unchanged.

Disposable owned containers on this exact image passed two new native lease-loss
cases, two existing cancellation cases, two command-admission cases and all four
memory scenarios in both 3 GiB and 2 GiB profiles. New lease controls explicitly
tick the real renewal after replacing the acquisition; production scheduling is
unchanged. Native data/PostgreSQL use private tmpfs storage, with no live database
or music/data binds. Each owned test container was removed and its absence verified.
The live application remains running and healthy.

The [design](MEDIA_LEASE_INTERRUPTION_DESIGN.md) records reproduction mounts and
profile guards. These selected results do not establish detection latency, a
minimum deployment memory size or complete background-worker cancellation. The
PostgreSQL integration lane separately used its cached 18.3 image; it is not
reported as packaged 18.6 evidence.

Private build logs, before/after inventories, readiness result, source hashes,
native results and retirement records remain in
`.tmp/media-lease-interruption-2026-10-23/`. No release or tag is created. The next
item is spectral proof/sidecar interruption, including claim and publication guards.
