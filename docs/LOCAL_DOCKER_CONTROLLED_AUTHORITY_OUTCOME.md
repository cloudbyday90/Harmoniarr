# Local Docker controlled authority outcome

Date: 2026-10-23. Follows the preserved-state path in [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md). Application changes and acceptance boundaries are recorded separately in the [implementation outcome](CONTROLLED_PROVIDER_AUTHORITY_OUTCOME.md).

## Rebuild and preservation

The first fresh-builder attempt failed resolving Docker registry CDN DNS before compilation. Its builder was removed and the running walkthrough remained unchanged. The second owned builder completed with --pull --no-cache --load, then was removed with absence verified.

- Previous image: sha256:bfd440e0ca5ae5e629d842f95853a36264e16f5cd2eee66a01c93cd92252b90b.
- Current image: sha256:3525bafee1ec19d35e3b05db232252f63b3862e7a759ea03b5e9bad6ca3e7a03, local tag harmoniarr:walkthrough-local.
- Compose startup used --no-build after the qualified rebuild. All five actual bind mount sources/destinations/access modes matched before/after, including the existing completed-download override. Administrator, database and data were preserved.
- Bootstrap recognized the existing administrator and its one-shot helper was retired. The app is healthy at http://127.0.0.1:47956 with a read-only root filesystem and UID 1000 on Linux amd64.
- Startup applied zero migrations and verified 112 applied/zero pending. Authenticated readiness-only validation passed. Its temporary password file and directory were removed.

## Artifact comparison and qualification

Exact comparison found only the intended three recovery files changed: music-queue-recovery-service.js, music-queue-recovery-store.js and the new music-queue-recovery-exhaustion-store.js. All other server/shared bytes and client artifacts were unchanged. Inventory: 914 server files, 11 shared files and 155 client artifacts.

Node 24.22.1, npm 12.0.2, the Node binary, 110 production npm packages and 151 installed OS packages matched the previous image. This retains the preceding unrelated native allocation/memory qualifications; no new memory sizing is claimed. Affected qualification includes the complete controlled-provider pipeline with current-authority/content checks and 35 candidate/spectral reputation cases on packaged PostgreSQL 18.6.

The separate packaged file-backed Music Queue verifier passed on the same image. Its project containers, networks, volumes and workspace were absent after cleanup. Native reputation and controlled-provider resources were also retired. Authenticated walkthrough readiness remains separate from these disposable fixtures and from acceptance by a live external provider.

Private rebuild/inventory/readiness/retirement evidence is under .tmp/controlled-authority-2026-10-23/rebuild-second/; the failed attempt and packaged qualification are retained in the parent evidence directory. This is a local rebuild and controlled qualification, not public-network provider acceptance or a release.

Completed follow-up: the [initial quality-review rebuild](LOCAL_DOCKER_PREFLIGHT_QUALITY_OUTCOME.md)
records the next no-cache image; its [implementation outcome](PREFLIGHT_QUALITY_REVIEW_OUTCOME.md)
connects persisted refusal to Missing Music. Next: a recipient-owned alternative-match
handoff from measured quality review, retaining current shared requirements and consent.
