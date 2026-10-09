# Harmoniarr

Harmoniarr is a self-hosted, Docker-hosted music library manager inspired by Lidarr, with Soulseek as the primary acquisition source.

The repository contains the Node.js ESM server, Vue client, PostgreSQL schema, automated validation, and design documents. The platform is under active development toward its first release.

Harmoniarr is being planned as a self-hosted FOSS application with no SLA or operational warranty. The docs in this repository describe intended behavior and design direction, not a hosted-service support commitment.

- [Planning document](docs/harmoniarr.md)
- [AI workflow and shared Copilot skills](docs/AI_WORKFLOW.md)
- [Docker deployment baseline](docs/DOCKER_DEPLOYMENT.md)
- [Local Docker walkthrough](docs/LOCAL_DOCKER_WALKTHROUGH.md)
- [Backup, restore, and upgrade design](docs/BACKUP_RESTORE_DESIGN.md)
- [Bootstrap-admin recovery runbook](docs/ADMIN_RECOVERY_RUNBOOK.md)
- [Security policy and posture](docs/SECURITY_POLICY.md)
- [Security benchmarks](docs/SECURITY_BENCHMARKS.md)
- [Release checklist](release.md)
- [External request discovery design and tradeoffs](docs/EXTERNAL_REQUEST_DISCOVERY_HANDOFF_DESIGN.md)
- [External request discovery outcome and next step](docs/EXTERNAL_REQUEST_DISCOVERY_HANDOFF_OUTCOME.md)
- [External collection design, sources, and tradeoffs](docs/EXTERNAL_COLLECTION_COMPLETION_DESIGN.md)
- [External collection outcome and release follow-up](docs/EXTERNAL_COLLECTION_COMPLETION_OUTCOME.md)
- [Provider access research, design, and tradeoffs](docs/PROVIDER_ACCESS_ACCEPTANCE_DESIGN.md)
- [Provider access outcome and acceptance runbook](docs/PROVIDER_ACCESS_ACCEPTANCE_OUTCOME.md)
- [PostgreSQL recovery research, design, and tradeoffs](docs/POSTGRES_RECOVERY_REHEARSAL_DESIGN.md)
- [PostgreSQL recovery outcome and next release work](docs/POSTGRES_RECOVERY_REHEARSAL_OUTCOME.md)
- [Missing Music pagination and preparation design](docs/MUSIC_QUEUE_PAGINATION_DESIGN.md)
- [Missing Music pagination outcome and release follow-up](docs/MUSIC_QUEUE_PAGINATION_OUTCOME.md)
- [Immutable candidate acceptance design](docs/IMMUTABLE_CANDIDATE_ACCEPTANCE_DESIGN.md)
- [Immutable candidate acceptance outcome and next release work](docs/IMMUTABLE_CANDIDATE_ACCEPTANCE_OUTCOME.md)
- [Request lifecycle Activity design](docs/REQUEST_LIFECYCLE_ACTIVITY_DESIGN.md)
- [Request lifecycle Activity outcome and recommendations](docs/REQUEST_LIFECYCLE_ACTIVITY_OUTCOME.md)
- [Transactional request lifecycle design](docs/TRANSACTIONAL_REQUEST_LIFECYCLE_DESIGN.md)
- [Transactional request lifecycle outcome](docs/TRANSACTIONAL_REQUEST_LIFECYCLE_OUTCOME.md)
- [Recipient eligibility consistency design](docs/RECIPIENT_ELIGIBILITY_CONSISTENCY_DESIGN.md)
- [Recipient eligibility consistency outcome](docs/RECIPIENT_ELIGIBILITY_CONSISTENCY_OUTCOME.md)
- [Published candidate trust design](docs/PUBLISHED_CANDIDATE_TRUST_DESIGN.md)
- [Published candidate trust outcome](docs/PUBLISHED_CANDIDATE_TRUST_OUTCOME.md)
- [Release provenance gate design](docs/RELEASE_PROVENANCE_GATE_DESIGN.md)
- [Release provenance gate outcome and next priorities](docs/RELEASE_PROVENANCE_GATE_OUTCOME.md)
- [Draft-first release lifecycle design](docs/DRAFT_RELEASE_LIFECYCLE_DESIGN.md)
- [Draft-first release lifecycle outcome](docs/DRAFT_RELEASE_LIFECYCLE_OUTCOME.md)
- [Candidate staging and tag promotion design](docs/RELEASE_TAG_PROMOTION_DESIGN.md)
- [Candidate staging and tag promotion outcome](docs/RELEASE_TAG_PROMOTION_OUTCOME.md)
- [Local workflow-script replay](docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md)
- [Missing Music Search again design](docs/MISSING_MUSIC_SEARCH_AGAIN_DESIGN.md)
- [Missing Music Search again outcome](docs/MISSING_MUSIC_SEARCH_AGAIN_OUTCOME.md)
- [Missing Music quality fallback design](docs/MISSING_MUSIC_QUALITY_FALLBACK_DESIGN.md)
- [Missing Music quality fallback outcome](docs/MISSING_MUSIC_QUALITY_FALLBACK_OUTCOME.md)
- [Missing Music Find matches design](docs/MISSING_MUSIC_FIND_MATCHES_DESIGN.md)
- [Missing Music Find matches outcome](docs/MISSING_MUSIC_FIND_MATCHES_OUTCOME.md)
- [Missing Music library-add recheck design](docs/MISSING_MUSIC_LIBRARY_ADD_RECHECK_DESIGN.md)
- [Missing Music library-add recheck outcome](docs/MISSING_MUSIC_LIBRARY_ADD_RECHECK_OUTCOME.md)
- [Missing Music Add to library design](docs/MISSING_MUSIC_ADD_TO_LIBRARY_DESIGN.md)
- [Missing Music Add to library outcome](docs/MISSING_MUSIC_ADD_TO_LIBRARY_OUTCOME.md)
- [Add to library open PR applicability design](docs/OPEN_PR_APPLICABILITY_ADD_TO_LIBRARY_2026_10_DESIGN.md)
- [Add to library open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_ADD_TO_LIBRARY_2026_10_OUTCOME.md)
- [Automatic library-add guard design](docs/MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_DESIGN.md)
- [Automatic library-add guard outcome](docs/MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_OUTCOME.md)
- [Fallback recovery guard design](docs/MUSIC_QUEUE_FALLBACK_RECOVERY_DESIGN.md)
- [Fallback recovery guard outcome](docs/MUSIC_QUEUE_FALLBACK_RECOVERY_OUTCOME.md)
- [Attempt-owned download confirmation design](docs/DOWNLOAD_HANDOFF_CONFIRMATION_DESIGN.md)
- [Attempt-owned download confirmation outcome](docs/DOWNLOAD_HANDOFF_CONFIRMATION_OUTCOME.md)
- [slskd transfer contract research](docs/SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md)
- [Batch download handoff design and recommendation stack](docs/BATCH_DOWNLOAD_HANDOFF_DESIGN.md)
- [Batch download handoff and operator adoption outcome](docs/BATCH_DOWNLOAD_HANDOFF_OUTCOME.md)
- [slskd batch API primary-source research](docs/SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md)
- [Guarded download origin resolution design](docs/DOWNLOAD_ORIGIN_RESOLUTION_DESIGN.md)
- [Guarded download origin resolution outcome](docs/DOWNLOAD_ORIGIN_RESOLUTION_OUTCOME.md)
- [Origin resolution official research](docs/ORIGIN_RESOLUTION_RESEARCH_2026_10.md)
- [Origin resolution open PR applicability design](docs/OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_DESIGN.md)
- [Origin resolution open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_OUTCOME.md)
- [Batch handoff open PR applicability design](docs/OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_DESIGN.md)
- [Batch handoff open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_OUTCOME.md)
- [Music metadata security update design](docs/MUSIC_METADATA_SECURITY_UPDATE_2026_10_DESIGN.md)
- [Music metadata security update outcome](docs/MUSIC_METADATA_SECURITY_UPDATE_2026_10_OUTCOME.md)
- [Fallback recovery open PR applicability design](docs/OPEN_PR_APPLICABILITY_RECOVERY_2026_10_DESIGN.md)
- [Fallback recovery open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_RECOVERY_2026_10_OUTCOME.md)
- [Automatic library-add open PR applicability design](docs/OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_DESIGN.md)
- [Automatic library-add open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_OUTCOME.md)
- [October 8 dependency security design](docs/DEPENDENCY_SECURITY_UPDATE_2026_10_08_DESIGN.md)
- [October 8 dependency security outcome](docs/DEPENDENCY_SECURITY_UPDATE_2026_10_08_OUTCOME.md)
- [Open PR applicability design](docs/OPEN_PR_APPLICABILITY_2026_10_DESIGN.md)
- [Open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_2026_10_OUTCOME.md)
- [Practical web standards skill design](docs/WEB_STANDARDS_SKILL_DESIGN.md)
- [Practical web standards skill outcome](docs/WEB_STANDARDS_SKILL_OUTCOME.md)
- [Random PR #24 local replay design](docs/RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md)
- [Random PR #24 local replay outcome](docs/RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md)
- [Scoped policy overrides skill design](docs/SCOPED_POLICY_OVERRIDES_SKILL_DESIGN.md)
- [Scoped policy overrides skill outcome](docs/SCOPED_POLICY_OVERRIDES_SKILL_OUTCOME.md)
- [Node runtime patch design](docs/NODE_RUNTIME_PATCH_2026_10_DESIGN.md)
- [Node runtime patch outcome](docs/NODE_RUNTIME_PATCH_2026_10_OUTCOME.md)
- [Random PR #40 local replay design](docs/RANDOM_PR_40_LOCAL_REPLAY_DESIGN.md)
- [Random PR #40 local replay outcome](docs/RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md)
- [Random PR #23 local replay design](docs/RANDOM_PR_23_LOCAL_REPLAY_DESIGN.md)
- [Random PR #23 local replay outcome](docs/RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md)
- [October dependency security design](docs/DEPENDENCY_SECURITY_UPDATE_2026_10_DESIGN.md)
- [October dependency security outcome](docs/DEPENDENCY_SECURITY_UPDATE_2026_10_OUTCOME.md)

## Current Direction

The current planning baseline includes a few explicit v1 decisions:

- Local first-run admin setup with Classifarr-style cookie-based browser auth.
- Refresh-token-backed sessions with deployment-controlled CSRF protection for cookie-authenticated writes. Release deployments should set `security.csrfProtectionMode` to `required`; an opt-out exists for tightly trusted local-only installs.
- Optional lightweight integration tokens may be added for local automation if a real use case appears, but normal browser administration remains session-based.
- Explicit path-mapping and staging boundaries between `slskd`, Harmoniarr, and final library roots.
- Staging-first treatment of completed Soulseek downloads before import into the library.

## Deployment Baseline

The repository now includes the deployment scaffolding for the planned standard container layout:

- `Dockerfile`
- `docker/entrypoint.sh`
- `compose.yaml`
- `compose.walkthrough.yaml`
- `compose.slskd-example.yaml`
- `.env.example`

The application builds and boots with embedded PostgreSQL, tracked SQL migrations, an Express API, and a Vue client on port `3000`. `/healthz` supports smoke validation. Library management, acquisition review, and recovery are implemented; the platform remains under validation toward its first supported release.

External artist and playlist requests use bounded provider preparation and explicit collection review. Administrators include local release editions or exclude captured items with a reason, then finalize the selection. Fulfillment requires imports for every distinct included release belonging to the request target.

The planned container target is 64-bit only. The current baseline should support `amd64` and `arm64`; 32-bit targets are not part of the supported runtime posture.

Recommended host path layout:

```text
/srv/harmoniarr
/srv/slskd/downloads
/srv/slskd/config
/srv/media/music
/srv/harmoniarr/staging
/srv/harmoniarr/transcode-temp
```

Recommended first-run `.env` values:

```text
TZ=UTC
PUID=1000
PGID=1000
UMASK=0022
APP_PORT=3000
HARMONIARR_PORT=47956
HARMONIARR_CONTACT_URL=https://github.com/cloudbyday90/harmoniarr
HARMONIARR_CONTACT_EMAIL=
HARMONIARR_CSRF_PROTECTION=required
HARMONIARR_APPDATA=/srv/harmoniarr
HARMONIARR_DOWNLOADS=/srv/slskd/downloads
HARMONIARR_MUSIC=/srv/media/music
HARMONIARR_STAGING=/srv/harmoniarr/staging
HARMONIARR_TRANSCODE_TEMP=/srv/harmoniarr/transcode-temp
SLSKD_BASE_URL=http://slskd:5030
SLSKD_WEB_PORT=5030
SLSKD_APPDATA=/srv/slskd/config
```

`HARMONIARR_CSRF_PROTECTION` defaults to `required`. Set it to `disabled` only for tightly trusted local-only or separately network-restricted deployments where you are intentionally accepting the CSRF tradeoff. A reverse proxy can reduce exposure and enforce network boundaries, but it is not a general substitute for CSRF protection by itself.

`PUID` and `PGID` now select the container user through Compose itself. Ensure the bound host paths are writable by that UID/GID pair; the default runtime path no longer tries to `chown` host mounts during startup.

The default Compose baselines now also run with a read-only container root filesystem. Writable state is limited to the explicit bind mounts and tmpfs mounts declared in the Compose files.

The checked-in Compose baselines also avoid floating image aliases. The Harmoniarr build tag is pinned to `0.1.0-beta`, and the side-by-side `slskd` example is pinned to `slskd/slskd:0.25.1` so version bumps stay reviewable instead of inheriting `latest` drift.

Repository security scanning now runs through a dedicated GitHub Actions workflow that combines the local `npm audit` policy, OSV dependency scanning, Trivy config scanning, and Trivy-backed secret scanning.

Repository supply-chain metadata now also runs through a separate GitHub Actions workflow that builds the current distributable outputs, generates an SPDX SBOM, submits a dependency snapshot to GitHub, and emits build-provenance attestations for public-repo runs.

Release publication now has its own GitHub Actions workflow as well. Published GitHub releases build and push a multi-architecture GHCR image plus a Docker Hub mirror when `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are configured in GitHub, capture the canonical GHCR digest, publish an SPDX SBOM as a release asset, and attach a short verification note with the exact `oci://...@sha256:...` reference and attestation-check commands.

That release workflow now also performs a post-publish smoke check against the immutable GHCR digest itself, not just against a local build, verifies the published release contract against the actual GitHub release assets, and publishes both a machine-readable `harmoniarr-release-metadata.json` asset and a ready-to-use `harmoniarr-release-compose.override.yaml` override for immutable deployments.

GHCR is the canonical trust boundary for release verification and attestation checks by default. Docker Hub remains an optional runtime mirror that is verified for tag coverage and digest parity unless the release workflow is explicitly configured with `DOCKERHUB_TRUSTED_MIRROR=true`, in which case the workflow also promotes copied OCI referrers through ORAS and verifies the discovered referrer graph against GHCR.

Outdated images are now handled separately through the scheduled `Container Image Maintenance` workflow. It deletes stale untagged GHCR package versions, and on Docker Hub it keeps `latest` plus the newest five non-protected tags by `last_updated` unless you override that retention on a manual run.

The checked-in Compose files stay on explicit version tags because those references are reviewable before a release exists. Once a release image is published, deployment-specific Compose files should prefer a fully qualified `tag@sha256:digest` reference so the running artifact is immutable as well as human-readable.

Operators who want a release-aligned Compose override can download the published `harmoniarr-release-compose.override.yaml` asset instead of hand-transcribing the digest from prose notes.

Docker defaults `HARMONIARR_CONTACT_URL` to the project URL so the baseline container can start with MusicBrainz enabled. Override it with your own project or operator contact URL, or set `HARMONIARR_CONTACT_EMAIL` instead, if you need a deployment-specific `User-Agent`.

If you want Harmoniarr and `slskd` side by side, start from `compose.slskd-example.yaml` and keep `/data/downloads` identical inside both containers.

If you want a disposable localhost-only walkthrough with a ready-made admin login, use `compose.walkthrough.yaml` and the explicit one-shot bootstrap flow documented in `docs/LOCAL_DOCKER_WALKTHROUGH.md`.

The Docker build context is trimmed with `.dockerignore` so docs, git metadata, logs, and local dependency trees do not get sent into routine image builds.

## License

Harmoniarr is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) and [COPYRIGHT.md](COPYRIGHT.md).
