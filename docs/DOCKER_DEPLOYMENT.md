# Harmoniarr Docker Deployment Baseline

## Purpose

This document turns the Docker and Compose planning in `docs/harmoniarr.md` into a concrete deployment baseline.

It focuses on:

- the canonical deployment files
- the local Docker build scaffold
- the paired `slskd` Compose example
- build-context cleanup via `.dockerignore`
- which configuration belongs in `.env` versus the app database
- recommended volume mappings
- `PUID` / `PGID` / `UMASK` defaults
- the default external port choice
- Dockerfile assumptions for the future standard image

This is a deployment baseline, not a release guarantee. The current repository still contains planning documents rather than a full runtime implementation.

The repository now includes a Dockerfile scaffold, `.dockerignore`, a minimal Express plus Vue runtime, and an entrypoint that initializes embedded PostgreSQL before running tracked SQL migrations and starting the app. This is still an early bootstrap slice rather than the finished Harmoniarr feature set.

## Canonical Deployment Files

Use these files for the default deployment model:

- `Dockerfile`
- `.dockerignore`
- `docker/entrypoint.sh`
- `compose.yaml`
- `compose.walkthrough.yaml`
- `compose.slskd-example.yaml`
- `.env`
- `.env.example`

Rules:

- `Dockerfile` and `docker/entrypoint.sh` define the planned container bootstrap flow.
- `.dockerignore` keeps docs, git metadata, logs, local dependency trees, and host env files out of the Docker build context.
- `compose.yaml` is the canonical Compose filename.
- `compose.walkthrough.yaml` is the disposable localhost-only evaluation stack that builds from the current repository and auto-creates a walkthrough admin through the existing public bootstrap route.
- `compose.slskd-example.yaml` shows the preferred shared-download-path layout when `slskd` is deployed beside Harmoniarr.
- `.env` sits beside `compose.yaml` and is host-specific.
- `.env.example` is committed and documents the supported variables.
- V1 should not depend on a separate mounted app config file such as `config.yml`.

## Configuration Model

Use this split:

- Docker and bootstrap configuration lives in `compose.yaml` plus `.env`.
- Persistent application settings live in the Harmoniarr database under `/app/data`.
- Generated runtime state such as embedded Postgres data, logs, caches, backups, and generated secrets also lives under `/app/data`.
- App-owned artwork storage lives under `/app/data/artwork`.
- `PUID` and `PGID` are deployment-boundary inputs used by Compose to choose the container user, not app settings consumed inside Harmoniarr.

Current scaffold behavior:

- the container boots an Express API and minimal Vue client on `APP_PORT`
- `/healthz` returns a simple JSON status response for smoke tests
- embedded PostgreSQL is initialized in `/app/data/postgres/18/data` if the cluster is absent
- the entrypoint creates the `harmoniarr` database by default, loads the checked-in schema snapshot into empty databases, applies any remaining tracked SQL migrations, verifies migration state, and then launches the app command
- the default Docker baseline now provides a project contact URL for MusicBrainz unless the operator overrides it in `.env`

Supported runtime architectures:

- `amd64`
- `arm64`

Architecture rules:

- Harmoniarr is a 64-bit application.
- 32-bit targets are unsupported.
- The Docker build and entrypoint should fail closed on unsupported architectures instead of attempting best-effort startup.

Why:

- it avoids two competing sources of truth for ordinary settings
- it matches the embedded-Postgres, Docker-first planning model already documented elsewhere
- it keeps host-specific deployment values separate from user-managed application behavior

## Environment Variable Baseline

Supported deployment variables:

- `TZ`
- `PUID`
- `PGID`
- `UMASK`
- `APP_PORT`
- `HARMONIARR_PORT`
- `HARMONIARR_BASE_URL`
- `HARMONIARR_CONTACT_URL`
- `HARMONIARR_CONTACT_EMAIL`
- `HARMONIARR_LOG_LEVEL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_CONTACT`
- `HARMONIARR_CSRF_PROTECTION`
- `HARMONIARR_ENFORCE_HTTPS`
- `HARMONIARR_ENABLE_STRICT_TRANSPORT_SECURITY`
- `HARMONIARR_SECURE_COOKIES`
- `HARMONIARR_APPDATA`
- `HARMONIARR_DOWNLOADS`
- `HARMONIARR_MUSIC`
- `HARMONIARR_STAGING`
- `HARMONIARR_TRANSCODE_TEMP`
- `SLSKD_BASE_URL`
- `SLSKD_WEB_PORT`
- `SLSKD_APPDATA`

Use `PUID` and `PGID`. Do not introduce `PGUID`.

Recommended defaults:

```text
TZ=UTC
PUID=1000
PGID=1000
UMASK=0022
APP_PORT=3000
HARMONIARR_PORT=47956
HARMONIARR_BASE_URL=
HARMONIARR_CONTACT_URL=https://github.com/cloudbyday90/harmoniarr
HARMONIARR_CONTACT_EMAIL=
HARMONIARR_LOG_LEVEL=info
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT=mailto:admin@example.com
HARMONIARR_CSRF_PROTECTION=disabled
HARMONIARR_ENFORCE_HTTPS=false
HARMONIARR_ENABLE_STRICT_TRANSPORT_SECURITY=false
HARMONIARR_SECURE_COOKIES=false
HARMONIARR_APPDATA=/srv/harmoniarr
HARMONIARR_DOWNLOADS=/srv/slskd/downloads
HARMONIARR_MUSIC=/srv/media/music
HARMONIARR_STAGING=/srv/harmoniarr/staging
HARMONIARR_TRANSCODE_TEMP=/srv/harmoniarr/transcode-temp
SLSKD_BASE_URL=http://slskd:5030
SLSKD_WEB_PORT=5030
SLSKD_APPDATA=/srv/slskd/config
```

Rationale:

- `PUID=1000` and `PGID=1000` match the most common first non-root Linux user and fit the default Compose-level user mapping.
- `UMASK=0022` aligns with the current planned default file and directory modes of `644` and `755`.
- `APP_PORT=3000` is the fixed internal HTTP port.
- `HARMONIARR_PORT=47956` is the chosen high, uncommon host port to avoid the common media-app defaults.
- `HARMONIARR_CONTACT_URL` defaults to the project URL so MusicBrainz-backed startup does not fail before operators customize their deployment metadata.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_CONTACT` are required for production Web Push startup. Generate the key pair once with `npm run generate:vapid-keys`, keep the private key in the host `.env` or secret store, and do not rotate it casually because existing browser push subscriptions are tied to the public key.
- Deployment security is now settings-driven and opt-in by default for local HTTP installs. These environment variables remain available as bootstrap fallbacks before an operator saves settings in the UI.
- `HARMONIARR_CSRF_PROTECTION=disabled` keeps local-only installs friction-free by default; set it to `required` when browser writes should carry CSRF tokens.
- `HARMONIARR_SECURE_COOKIES=true`, `HARMONIARR_ENFORCE_HTTPS=true`, and `HARMONIARR_ENABLE_STRICT_TRANSPORT_SECURITY=true` should only be enabled when Harmoniarr is actually served behind HTTPS, typically through a reverse proxy or TLS terminator.

CSRF policy guidance:

- Keep `security.csrfProtectionMode=required` for normal browser-administered deployments.
- Only use `disabled` when the app is not exposed beyond a tightly trusted operator boundary and you are intentionally accepting the residual CSRF risk.
- A reverse proxy can reduce exposure and enforce network boundaries, but it does not automatically replace CSRF protections for cookie-authenticated browser sessions.

HTTPS and cookie policy guidance:

- Keep `security.secureCookies`, `security.enforceHttps`, and `security.strictTransportSecurity` disabled for direct local HTTP use.
- Enable all three together when the app is published behind HTTPS so cookies are not sent over plain HTTP, safe browser requests redirect to HTTPS, and browsers remember the HTTPS-only transport rule.
- When `security.enforceHttps` is enabled, safe requests are redirected to `https://...` and unsafe writes over plain HTTP are rejected.

Bind-mount rule:

- Host paths must already be writable by the selected `PUID` and `PGID` pair.
- The default container startup path should not attempt to repair host ownership through runtime `chown`, `chmod`, or in-container privilege dropping.

## External Port Policy

Default external port:

```text
47956
```

Why this port:

- it was generated from a high unprivileged range
- it is less collision-prone than the common `8080`, `3000`, `5000`, `8989`, `8686`, `9696`, or `7878` style defaults
- it keeps the standard deployment from looking identical to the usual media-stack port expectations

Limits of this choice:

- a randomized high port is collision avoidance and mild obscurity only
- it is not a replacement for authentication, reverse-proxy HTTPS, or safe exposure decisions

## Recommended Volume Mappings

The default deployment should keep each path role explicit.

Recommended in-container mount targets:

- `/app/data`
- `/data/downloads`
- `/data/music`
- `/data/staging`
- `/data/transcode-temp`

Meaning:

- `/app/data`: app-owned persistent state, including embedded Postgres and generated runtime files
- `/app/data/artwork`: artwork originals, derivatives, extracted durable copies, and temporary artwork-processing workspace
- `/data/downloads`: the download tree Harmoniarr sees from `slskd`
- `/data/music`: final library root
- `/data/staging`: pre-import review, validation, quarantine, and temporary work area
- `/data/transcode-temp`: scratch space for future transcoding/media processing jobs

Recommended artwork subtree under the app-data volume:

```text
/app/data/artwork/originals
/app/data/artwork/derivatives
/app/data/artwork/extracted
/app/data/artwork/tmp
```

## Recommended Host Path Layout

Linux/NAS-style example:

```text
/srv/harmoniarr
/srv/slskd/downloads
/srv/media/music
/srv/harmoniarr/staging
/srv/harmoniarr/transcode-temp
```

Recommended mapping:

```text
/srv/harmoniarr                -> /app/data
/srv/slskd/downloads           -> /data/downloads
/srv/media/music               -> /data/music
/srv/harmoniarr/staging        -> /data/staging
/srv/harmoniarr/transcode-temp -> /data/transcode-temp
```

Practical guidance:

- keep `staging` outside the final library root so unfinished or quarantined files are never mistaken for imported media
- keep `transcode-temp` separate from `staging` so future long-running media jobs do not pollute import review space
- keep the app data directory separate from downloads and media so backups and restore boundaries remain understandable
- treat `originals` as the durable artwork store and `derivatives` as disposable cache inside `/app/data/artwork`

## Download Path And slskd Interop

The safest default is to let both `slskd` and Harmoniarr see the same in-container download path, ideally `/data/downloads`.

Example:

```text
slskd completed path:     /data/downloads/completed
harmoniarr completed path: /data/downloads/completed
```

Why this is preferred:

- fewer path-translation rules
- fewer import-boundary mistakes
- easier support and documentation

If the paths cannot match, Harmoniarr should rely on explicit path-prefix mappings as described in `docs/harmoniarr.md` and `docs/SECURITY_POLICY.md`.

For operators who want a one-file example of this layout, `compose.slskd-example.yaml` keeps both services aligned on `/data/downloads` and points Harmoniarr at `http://slskd:5030` by default.

For local exploration of the current repository without hand-preparing `.env` or host `/srv/...` paths, `compose.walkthrough.yaml` keeps all state under `./.data/walkthrough`, binds the app only to `127.0.0.1:47956`, and defines a one-shot bootstrap helper that the walkthrough docs run explicitly so the normal stack stays free of stale setup containers.

## Release Deployment Assets

Published releases now emit three operator-facing release-contract assets alongside the image itself:

- `harmoniarr-release.spdx.json`
- `harmoniarr-release-metadata.json`
- `harmoniarr-release-compose.override.yaml`

Use them this way:

- `harmoniarr-release-metadata.json` is the machine-readable source of truth for the immutable image reference, release tag, and expected asset names.
- `harmoniarr-release-compose.override.yaml` is the ready-to-use Compose override that pins `harmoniarr` to the published `tag@sha256:digest` image reference.
- the release workflow now verifies that those assets are actually attached to the GitHub release and that the metadata and Compose override agree with the published digest before the release contract is considered complete.

Practical operator flow:

```bash
gh release download vX.Y.Z-beta -R OWNER/REPO -p harmoniarr-release-compose.override.yaml -p harmoniarr-release-metadata.json -D .
docker compose -f compose.yaml -f harmoniarr-release-compose.override.yaml up -d
```

If you want to validate the downloaded manifest locally against the current release asset list, first capture the release asset inventory:

```bash
gh release view vX.Y.Z-beta -R OWNER/REPO --json assets,tagName,isImmutable > release-view.json
```

Then run the native ESM verifier:

```bash
HARMONIARR_RELEASE_METADATA_PATH=harmoniarr-release-metadata.json \
HARMONIARR_RELEASE_COMPOSE_OVERRIDE_PATH=harmoniarr-release-compose.override.yaml \
HARMONIARR_RELEASE_VIEW_PATH=release-view.json \
HARMONIARR_RELEASE_EXPECTED_REPOSITORY=OWNER/REPO \
npm run validate:release-contract
```

## Compose Baseline

The default Compose template should expose only the Harmoniarr HTTP port and should not publish embedded Postgres `5432`.

### Supported topology

The checked-in deployment and walkthrough are explicitly single-node:
`harmoniarr` uses `deploy.mode: replicated` with `deploy.replicas: 1`. The
container owns embedded PostgreSQL and host-backed writable state, so it is not
safe to horizontally scale this service or point multiple containers at the
same mounted paths. The repository validation and security gate reject a
supported Compose file that drops or changes this contract.

Do not use `docker compose up --scale harmoniarr=...` with this deployment.
Before any multi-replica design, move the database and application state to an
approved shared topology, establish the shared outbound network identity, and
add a centrally coordinated MusicBrainz rate limiter. The current one-process
metadata client queue is correct only for this supported single-node shape.

Planned baseline shape:

```yaml
services:
  harmoniarr:
    build:
      context: .
      dockerfile: Dockerfile
    image: ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta
    deploy:
      mode: replicated
      replicas: 1
    user: "${PUID:-1000}:${PGID:-1000}"
    read_only: true
    environment:
      TZ: ${TZ:-UTC}
      UMASK: ${UMASK:-0022}
      APP_PORT: ${APP_PORT:-3000}
    ports:
      - "${HARMONIARR_PORT:-47956}:${APP_PORT:-3000}"
    volumes:
      - "${HARMONIARR_APPDATA}:/app/data"
      - "${HARMONIARR_DOWNLOADS}:/data/downloads"
      - "${HARMONIARR_MUSIC}:/data/music"
      - "${HARMONIARR_STAGING}:/data/staging"
      - "${HARMONIARR_TRANSCODE_TEMP}:/data/transcode-temp"
```

Runtime posture expectations:

- `restart: unless-stopped`
- `init: true`
- `read_only: true`
- `no-new-privileges`
- drop unnecessary capabilities
- explicit image versions instead of floating aliases such as `latest`
- prefer `tag@sha256:digest` references in deployment-specific Compose files once a published image digest exists
- writable paths only via bind mounts and tmpfs where needed

## Dockerfile Assumptions

The future standard Docker image should follow these assumptions.

### Base And Stages

- multi-stage build
- Node 24.19 LTS Alpine image for builder stages, with npm 12.0.2 installed
  explicitly
- Alpine 3.23 runtime image
- Vite client built in a builder stage
- production server dependencies prepared in a builder stage

### Runtime Package Set

The runtime image should include only practical packages needed for the default deployment, such as:

- Node.js runtime
- embedded PostgreSQL 18 packages
- FFmpeg
- timezone data
- shell/runtime utilities needed by the entrypoint

Avoid expanding the image with broad debugging or development-only packages by default.

### Runtime User Model

- ship with a dedicated `harmoniarr` user and group
- default to `1000:1000`
- prefer Compose-level user selection via `user: "${PUID:-1000}:${PGID:-1000}"`
- avoid runtime `chown`, `chmod`, or `su-exec` remap logic on the default startup path
- ensure tmpfs/runtime paths such as `/run/postgresql` are created with the selected UID/GID when Compose defines them

### Writable Paths

The default writable paths should be explicit:

- `/app/data`
- `/tmp`
- `/run/postgresql`
- `/data/staging`
- `/data/transcode-temp`

`/data/downloads` and `/data/music` are also operationally writable in the common deployment because import and organization flows need them.

The rest of the container filesystem should stay read-only in the default Compose baseline. If a future feature needs another writable path, add it explicitly through a bind mount or tmpfs and extend the Docker smoke validation to prove that contract.

## Supply-Chain Update Path

The repository now uses Dependabot as the minimum automated update path for the deployment surface:

- `npm` dependencies from the root manifest and lockfile
- Dockerfile base images through the `docker` ecosystem
- Compose-managed image tags through the `docker-compose` ecosystem
- pinned GitHub Actions versions under `.github/workflows`

The checked-in Compose files now also keep their default image references on explicit versions instead of floating aliases. In practice this means the Harmoniarr build tag is pinned to `0.1.0-beta`, and the side-by-side example pins `slskd/slskd:0.25.1` until a review deliberately bumps it.

That checked-in baseline is intentionally version-pinned rather than digest-pinned because the repository needs stable, reviewable examples before a release image exists. Once a published image is available, operators should prefer deployment-local references in the form `ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta@sha256:<digest>` so the chosen artifact is both human-readable and immutable.

This does not replace vulnerability scanning, release review, or pinned-digest decisions for production deployments. It does provide a concrete, reviewable PR path so Node packages, Docker bases, Compose image references, and workflow actions do not drift silently.

The repository now also runs a dedicated `Security Scanning` GitHub Actions workflow that layers:

- local `npm audit` policy enforcement
- OSV dependency scanning with GitHub code-scanning output
- Trivy config scanning for Docker and Compose misconfiguration
- Trivy-backed filesystem secret scanning

The repository now also runs a dedicated `Supply Chain` GitHub Actions workflow that layers:

- real `npm ci` plus `npm run build` artifact generation
- SPDX SBOM generation through Anchore's maintained Syft-based action
- GitHub dependency snapshot submission from that SBOM run
- GitHub artifact attestations for built outputs and the generated SBOM on public-repo runs

Published GitHub releases now also run a dedicated `Release Image` workflow that pushes the multi-architecture GHCR image, optionally mirrors the same tags to Docker Hub when GitHub Actions has `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, captures the canonical GHCR manifest-list digest, publishes an SPDX SBOM release asset, and attaches a verification note with the immutable `oci://...@sha256:...` reference.

The same workflow now also smoke-tests the published immutable image reference against the checked-in Compose baseline before treating the release as complete, and it emits a machine-readable `harmoniarr-release-metadata.json` asset that records the canonical digest and release assets for downstream tooling.

That release metadata now also records the registry trust boundary explicitly: GHCR is the canonical source for immutable deployment references, provenance, and attestation verification by default, while Docker Hub is treated as an optional runtime mirror that is verified for mirrored tags and digest parity. If repository variable `DOCKERHUB_TRUSTED_MIRROR` is set to `true`, the release workflow also promotes copied OCI referrers to Docker Hub through ORAS and verifies the discovered referrer graph against GHCR. Without that explicit opt-in, operator trust decisions should continue to anchor on the GHCR immutable reference.

If your Docker Hub namespace does not match the GitHub repository owner, set repository variables `DOCKERHUB_NAMESPACE` and optionally `DOCKERHUB_REPOSITORY` so the mirror tags land in the intended Docker Hub repository.

Outdated published images are maintained by the separate `Container Image Maintenance` workflow:

- GHCR cleanup deletes stale untagged container package versions while retaining the newest 10 untagged versions.
- Docker Hub cleanup keeps `latest` plus the newest 5 non-protected tags by `last_updated` and deletes older tags through the existing Hub tag-management endpoint.
- Manual runs support preview mode through the workflow's `dry_run` input before deletion is enabled.

### Entrypoint Assumptions

The future entrypoint should:

1. normalize environment values
2. ensure required directories exist
3. rely on the selected container user and pre-provisioned host permissions instead of mutating host ownership at runtime
4. initialize embedded Postgres if the cluster does not exist yet
5. start Postgres on loopback and Unix socket only
6. verify database readiness
7. run migration verification and startup guards
8. generate required runtime secrets if they are absent
9. start the Harmoniarr app process

The current scaffold completes this flow by starting the built Express runtime from `/app/server-dist/index.js` after the migration runner and startup guard pass.

### Exposure Rules

- expose only the internal HTTP port from the app container
- do not publish `5432`
- rely on reverse proxies for external HTTPS if operators want it
- keep application auth in Harmoniarr even behind a reverse proxy

## What This Means For V1

For v1, the standard supported deployment story should be:

- one Harmoniarr container
- embedded Postgres inside that container
- explicit mounted paths for app data, downloads, music, staging, and future transcoding temp space
- `compose.yaml` plus `.env` as the deployment configuration surface
- `compose.walkthrough.yaml` as the disposable repo-local evaluation surface
- no separate mounted application config file required for normal operation
