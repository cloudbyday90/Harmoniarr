# Local Docker spectral reputation outcome

Recorded October 23, 2026 after the preserved-state
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The separate
[implementation outcome](SPECTRAL_REPUTATION_OUTCOME.md) owns reproduction,
validation scope, tradeoffs and the next recommendation.

## Rebuild and state

A fresh owned Buildx builder used `--pull --no-cache --load` to build
`harmoniarr:walkthrough-local`. Builder removal and absence were verified. The
existing service restarted with `up -d --wait --no-build`.

- Image: `sha256:0f21a594fa43131a162298c0a02ef551cc323175b4b6b9dcb66c88b5e8c80e5e`.
- Healthy at **http://127.0.0.1:47956**, Linux amd64, UID 1000, read-only root.
- All **five actual bind mounts** match before/after, including the existing
  completed-download override. Application data and administrator were preserved;
  bootstrap reused the admin and its helper was retired.
- Startup applied **zero migrations**, verifying **112 applied and zero pending**.
- Authenticated readiness-only browser validation passed. It submitted no search,
  download or transfer command and establishes no new provider acceptance. Its
  temporary password-only file outside the repository was removed.

## Exact runtime comparison

Compared with preceding image
`sha256:26b513c240ed924d3c34d78c9e5a674103259379d99aa268b0a89f5913d43dc9`,
fifteen reviewed server artifacts changed, including four new modules: publication
scope, trust snapshot store, mutation adapter and outcome projection policy.
All other **897 server files**, **11 shared files** and **155 client artifacts**
retain their bytes. The image contains **912 server files**. Root metadata matches
the candidate; its package change only adds the explicit native reputation lane.

Node 24.22.1, npm 12.0.2, the Node binary hash, all 110 production npm packages and
all 151 operating-system package versions remain unchanged. Packaged tools retain
Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6. Lockfile,
Dockerfile, Compose manifest, app version and migration/snapshot bytes are unchanged.

## Affected packaged qualification

This immutable image passed **15 shared reputation scenarios**, querying actual
PostgreSQL **18.6** before execution, plus **ten queue admission cases** and
**two native spectral interruption cases**. Reputation includes actual Linux
consumer exits on both sides of commit, atomic rollback/recovery, duplicate
identity refusal and ten snapshot/spectral lock handovers across all canonical
mutation types. The separate app fixture cohort also verified both actual
application composition entrypoints on isolated PostgreSQL 18.3.

Native checks use read-only source/test mounts whose production bytes match the
image, private tmpfs application/PostgreSQL storage, no network or published ports,
UID 1000, read-only root, two CPUs, 256 PIDs and 3 GiB memory/swap limits. Each owned
native container was removed and absence verified; the live walkthrough stays
running. Actual child/stdio close and server-side transaction retirement precede
the crash-recovery assertions.

Exact runtime comparison and unchanged native media/image admission/allocation
implementations support retaining the preceding two-/three-GiB qualification
without repeating those unrelated lanes. This is no new memory sizing result,
classification-accuracy claim, whole-application quiescence proof or exactly-once
notification guarantee. Durable reputation and returned advisory completion are
distinct boundaries.

Private build, inventory, readiness, frozen artifact, native and retirement records
remain under `.tmp/spectral-reputation-2026-10-23/`. No release or tag is created.
Next: establish stable producer identities for non-spectral evidence before
promoting its legacy best-effort ledger policy to atomic publication.
