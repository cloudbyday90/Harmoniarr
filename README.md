# Harmoniarr

Harmoniarr is a planned standalone Docker-hosted music library manager inspired by Lidarr, designed around Soulseek as the primary acquisition source.

The current repository contains planning documents while product, architecture, and implementation direction are being finalized.

Harmoniarr is being planned as a self-hosted FOSS application with no SLA or operational warranty. The docs in this repository describe intended behavior and design direction, not a hosted-service support commitment.

- [Planning document](docs/harmoniarr.md)
- [Docker deployment baseline](docs/DOCKER_DEPLOYMENT.md)
- [Backup, restore, and upgrade design](docs/BACKUP_RESTORE_DESIGN.md)
- [Bootstrap-admin recovery runbook](docs/ADMIN_RECOVERY_RUNBOOK.md)
- [Security policy and posture](docs/SECURITY_POLICY.md)
- [Security benchmarks](docs/SECURITY_BENCHMARKS.md)
- [Release checklist](release.md)
- [Local workflow-script replay](docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md)

## Current Direction

The current planning baseline includes a few explicit v1 decisions:

- Local first-run admin setup with Classifarr-style cookie-based browser auth.
- Refresh-token-backed sessions with default-on CSRF protection for cookie-authenticated writes, plus an explicit deployment-level opt-out for tightly trusted local-only installs.
- Optional lightweight integration tokens may be added for local automation if a real use case appears, but normal browser administration remains session-based.
- Explicit path-mapping and staging boundaries between `slskd`, Harmoniarr, and final library roots.
- Staging-first treatment of completed Soulseek downloads before import into the library.

## Deployment Baseline

The repository now includes the deployment scaffolding for the planned standard container layout:

- `Dockerfile`
- `docker/entrypoint.sh`
- `compose.yaml`
- `compose.slskd-example.yaml`
- `.env.example`

This is still a scaffold, not a supported runnable release. The container bootstrap shape is defined, but the actual Harmoniarr application runtime is still pending.

The current scaffold now does build and boot successfully: embedded PostgreSQL is initialized inside the container, tracked SQL migrations are applied at startup, an Express API serves a minimal Vue client on port `3000`, and `/healthz` responds for smoke-test validation. This is still an early bootstrap slice rather than the finished Harmoniarr feature set.

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

The Docker build context is trimmed with `.dockerignore` so docs, git metadata, logs, and local dependency trees do not get sent into routine image builds.

## License

Harmoniarr is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) and [COPYRIGHT.md](COPYRIGHT.md).
