# Local Docker candidate reputation outcome

Recorded October 23, 2026 after the preserved-state [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The separate [implementation outcome](CANDIDATE_REPUTATION_OUTCOME.md) records reproduction, design choices and validation limits.

## Rebuild and preserved state

A fresh owned Buildx builder ran `--pull --no-cache --load`, producing
`sha256:bfd440e0ca5ae5e629d842f95853a36264e16f5cd2eee66a01c93cd92252b90b` as `harmoniarr:walkthrough-local`.
Builder removal and absence were verified. Compose restarted the service with
`up -d --wait --no-build` and the one-shot bootstrap helper reused the existing
administrator, then retired.

The service is healthy at **http://127.0.0.1:47956**, Linux amd64, UID 1000 with a
read-only root. All **five actual bind mounts** match before and after, including
the completed-download override. Existing app data and admin were preserved.
Startup applied zero migrations, verifying **112 applied and zero pending**.
Authenticated readiness-only validation passed; its password-only temporary file
outside the repository was deleted. It submitted no live provider search/transfer.

## Runtime comparison

The preceding image was
`sha256:0f21a594fa43131a162298c0a02ef551cc323175b4b6b9dcb66c88b5e8c80e5e`.
Exactly six server artifacts changed, including the new candidate publication
service. The other **907 server files**, **11 shared files** and **155 client
artifacts** retain their bytes. The new image has **913 server files**; source and
root metadata match the frozen candidate. The sole package metadata change adds
the explicit native candidate reputation command.

Node 24.22.1, npm 12.0.2, Node binary hash, all 110 production npm packages and
151 operating-system package versions are unchanged. Packaged tools retain
PostgreSQL 18.6, Sharp 0.35.5/libvips 8.18.7 and FFmpeg/FFprobe 8.0.1. Dockerfile,
Compose manifests, lockfile, schema, migrations and app version are unchanged.

## Packaged qualification

The immutable image passed **35 shared PostgreSQL cases**: twenty candidate and
fifteen spectral reputation cases. Actual PostgreSQL 18.6 was queried before the
run. Production test mounts match image bytes. Native fixtures use private tmpfs
storage, no network/published ports, UID 1000, read-only root, two CPUs, 256 PIDs
and 3 GiB memory/swap limits. The owned container was removed and absence verified.
Actual child close and server transaction retirement precede crash-recovery
assertions; native and isolated PostgreSQL use the same case registrars.

The separate walkthrough file-backed Music Queue validator passed using the same
immutable image in disposable storage. It verifies a real FLAC library add,
quality and collision stops, isolated folder-mapping repair and FFprobe recovery.
The successful add also has exactly one event-correlated ledger success. Project
container/network/volume and workspace absence were verified after cleanup.

The optional wider controlled-provider pipeline remains unqualified: baseline
and candidate both refuse its first download at the current acquisition-authority
check after its search-ID fixture was corrected. The [implementation outcome](CANDIDATE_REPUTATION_OUTCOME.md)
records the retained failures and next fixture investigation. This does not
invalidate the passing file-backed walkthrough or establish broad provider
acceptance.

Unchanged image/media admission and allocation components support retaining their
preceding memory qualifications. This round establishes no new deployment sizing,
whole-app quiescence, notification exactly-once or live provider acceptance claim.
Private inventory/build/readiness/native/retirement records remain under
`.tmp/candidate-reputation-2026-10-23/`. No release or tag was created.

Completed follow-up: the [controlled authority rebuild](LOCAL_DOCKER_CONTROLLED_AUTHORITY_OUTCOME.md)
records the newer no-cache image; its [implementation outcome](CONTROLLED_PROVIDER_AUTHORITY_OUTCOME.md)
restores full controlled-provider qualification with permitted/refused authority.
Next: persist/project initial quality-preflight review, then measure snapshot
contention before choosing per-source persistence with explicit overrides and
coherent restores.
