# Harmoniarr Local Docker Walkthrough

This walkthrough gives you one disposable local Docker path for exploring the current app without hand-editing a host `.env` file or using the first-run bootstrap form manually.

It is intentionally separate from the canonical deployment baseline in `compose.yaml`.

## What It Does

- builds the local image from the current repository
- binds the app only to `127.0.0.1:47956`
- keeps all walkthrough data under `./.data/walkthrough/`
- provides a disposable local-only secret encryption key so provider API keys can be saved from Settings
- uses the shipped public bootstrap route to create one local admin through a one-shot helper after the app becomes healthy

Local walkthrough credentials:

- username: `walkthrough-admin`
- password: `HarmoniarrLocal123!`

These credentials live in `docker/walkthrough.env` and are only meant for disposable local exploration.

The walkthrough Compose file also sets a deterministic local fallback for
`HARMONIARR_SECRET_ENCRYPTION_KEY`. That key exists only so Settings can store
encrypted provider secrets during local exploration. Do not reuse it for
production. For a real deployment, set your own 32-byte key as 64 hex
characters or base64 and keep it stable for as long as encrypted settings need
to be read.

## Optional: Last.fm API Key

To enable similar-artist recommendations in Discover, set the `LASTFM_API_KEY` environment variable before starting the stack. The key is free and unlimited — get one at https://www.last.fm/api/account/create.

```powershell
$env:LASTFM_API_KEY = "your-key-here"
docker compose -f compose.walkthrough.yaml build harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
```

## Start

From the repository root:

```powershell
docker compose -f compose.walkthrough.yaml build harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
```

When the stack is ready, open:

```text
http://127.0.0.1:47956
```

The one-shot `walkthrough-bootstrap` helper exits successfully after creating the walkthrough admin. That is expected. Running it through `docker compose run --rm` keeps the normal walkthrough stack clean instead of leaving an exited helper container behind.

In Settings > Connections, choose the provider mode before configuring
Soulseek:

- **External** is the walkthrough default. Enter the address and API key for
  the separately run provider, then use `Test Soulseek` to refresh its saved
  connection status.
- **Managed** is for the managed Compose overlay described below. Its address
  and API key come from deployment secrets rather than Settings.
- **Disabled** pauses Soulseek searches/downloads and prevents Downloader
  polling. It preserves an existing external API key for later reuse.

The external API key is write-only: the field intentionally stays blank after
save, and leaving it blank keeps the stored key.

## Managed slskd Deployment

The walkthrough intentionally keeps slskd external so it remains disposable.
For a persistent managed provider deployment, use `compose.yaml` with
`compose.slskd-example.yaml` instead. The managed overlay creates a private
provider network, renders `slskd.yml` from Docker secret files, and aligns
completed downloads at `/data/downloads` without a normal-case path mapping.
See [Managed slskd Deployment Contract](MANAGED_SLSKD_DEPLOYMENT_CONTRACT.md).

To replay the account-free managed provider startup proof on a Docker-capable
machine, run:

```powershell
npm run validate:managed-slskd-smoke
```

It creates and removes a separate temporary project, uses disposable secrets,
and intentionally blocks the provider's external network access. It proves
configuration rendering and private API access only; it does not test a real
Soulseek login, search, or download. See [Managed slskd Docker Smoke
Design](MANAGED_SLSKD_DOCKER_SMOKE_DESIGN.md).

If slskd is running outside the walkthrough Compose stack, Harmoniarr also needs
container-visible access to the folder where slskd writes completed downloads.
A Windows or Unraid host path such as `Y:\` is not visible inside the
Harmoniarr container by itself. Bind-mount that folder, or the completed music
subfolder, into Harmoniarr and then add a Settings > Media & storage path
mapping from the slskd container path to the Harmoniarr container path.

The walkthrough uses its repo-local downloads folder by default. To bind a
different completed-download host folder without editing Compose or committing
your machine path, set this shell-only override before starting the stack:

```powershell
$env:HARMONIARR_WALKTHROUGH_DOWNLOADS_HOST_PATH = "Y:\"
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
```

The folder is mounted inside Harmoniarr as `/data/downloads`. Then open
**Settings > Media & storage**, select **Add path translation**, and enter the
path the download client reports alongside Harmoniarr's mounted path. For
example, map `/downloads/Complete/Music` to `/data/downloads`. Do not enter
`Y:\` in Harmoniarr's path field: that is a host path, not a path available
inside the container.

The setup prompt in Media & storage appears whenever downloads are enabled but
no translation is saved. A translation confirms how two applications view the
same folder; it does not mount a host folder by itself.

## Verifying Provider Download Acceptance

After Soulseek is configured and at least one Import Review candidate is
selected, open `Advanced diagnostics > Run history and controls` in Import
Review, then use its download runway:

1. Click `Start download run`.
2. Click `Sync transfer state`.
3. Read the `Download acceptance diagnostic` on the selected run item.

The diagnostic should say whether the provider accepted a transfer or why the
candidate did not reach Downloader. Expected actionable outcomes include:

- `Provider accepted transfer`: open Downloader and monitor the transfer.
- `Provider accepted with warnings`: some files were rejected; review before
  import apply.
- `Provider rejected the candidate`: try another candidate or rerun discovery.
- `No downloadable files`: review locked or filtered files on the candidate.
- `Download planning blocked`: fix path mappings or validation blockers first.

If Downloader stays empty, this diagnostic is the first place to check before
reading container logs. It intentionally shows bounded counts and operator
actions, not API keys, raw provider payloads, or stack traces.

## Verifying Import Readiness

Provider acceptance is not the same as import readiness. slskd can accept and
complete transfers while Harmoniarr still cannot import them if the completed
download folder is not mounted into the Harmoniarr container or if the path
mapping is missing.

After a download run records accepted or completed transfers:

1. Open `Activity > Imports`.
2. Check the `Import readiness` summary.
3. If candidates are blocked, use `Review import` to open the candidate in
   Import Review.
4. If the source path is missing, open `Settings > Media & storage` and add a
   download mapping from the slskd completed-download path to the Harmoniarr
   container path.

For example, if slskd reports completed files under
`/downloads/complete/Music`, and the same host folder is mounted into
Harmoniarr at `/data/downloads/complete`, configure:

```text
Provider path: /downloads/complete/Music
Harmoniarr path: /data/downloads/complete
```

The Activity Imports page should then move from blocked import readiness to a
ready or warning state after refresh.

To capture replayable local evidence from a configured walkthrough:

```powershell
$env:HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_EVIDENCE_PATH = ".tmp\docker-provider-acceptance\provider-acceptance.json"
$env:HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_SCREENSHOT_DIR = ".tmp\docker-provider-acceptance\screenshots"
$env:HARMONIARR_WALKTHROUGH_USERNAME = "walkthrough-admin"
$env:HARMONIARR_WALKTHROUGH_PASSWORD = "HarmoniarrLocal123!"
npm run validate:docker-provider-acceptance
```

The evidence command verifies configured provider status, path mapping
presence, durable Import Review download acceptance diagnostics, and the
browser-visible diagnostic panel. To require that slskd accepted at least one
transfer, run:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer
```

For a Music Queue-origin transfer, add the strict linkage check. It verifies
that at least one current Downloader transfer is linked to Music Queue, then
uses the visible native filter and a Downloader refresh to confirm that the
same linkage remains available:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer --require-music-queue-link
```

The extra `--` is required by the repository's npm 12 script invocation before
forwarding flags to the Node validator. Boolean options are presence flags;
do not append `true` or `false`. For an intentionally unconfigured walkthrough
diagnostic, use the corresponding `--no-require-*` flags instead:

```powershell
npm run validate:docker-provider-acceptance -- -- --no-require-configured-provider --no-require-path-mapping --no-require-diagnostic
```

When a selected strict check cannot pass yet, the command keeps its failing exit
code but reports one label, the missing condition, and the next action. If an
evidence path is configured, it saves that bounded readiness result first. The
artifact contains counts and configuration booleans only; it does not contain
API keys, provider endpoint values, download paths, transfer IDs, or raw
provider responses.

If you need a fully clean rebuild while testing Docker changes, use:

```powershell
docker compose -f compose.walkthrough.yaml build --no-cache harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
```

## File-Backed Music Queue Recovery Validation

The repository also has a disposable packaged-runtime proof for the completed
download mapping and safe library-add recovery path:

```powershell
npm run validate:docker-file-backed-music-queue
```

It does not use your walkthrough provider, downloads, or music library. The
validator creates temporary bind mounts, generates real FLAC fixtures inside
the packaged container, proves one repaired folder mapping resumes only the
affected release, and proves collision and strict-quality stops stay in review.
It removes its project, volumes, and temporary directories on completion.

## Stop

```powershell
docker compose -f compose.walkthrough.yaml down --remove-orphans
```

## Reset

If you want a brand-new walkthrough state, stop the stack and remove the local walkthrough data directory:

```powershell
docker compose -f compose.walkthrough.yaml down --remove-orphans
Remove-Item -Recurse -Force .\.data\walkthrough
```

## Deployment Validation Replay

For release-path evidence, use the canonical `compose.yaml` validator instead
of the walkthrough stack:

```powershell
$env:HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR = ".tmp\docker-deployment-evidence"
$env:HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH = ".tmp\docker-deployment-evidence\harmoniarr-docker-deployment-summary.json"
npm run generate:vapid-keys
# Set the generated VAPID_* values in this shell or a secret store.
npm run validate:docker-deployment-path
```

To capture packaged-runtime browser evidence from the walkthrough stack:

> The browser smoke is a fresh, unconfigured-provider check. It specifically
> expects the Discovery heartbeat to be `setup_required`, Downloader to be
> disabled, and no operator notifications. Run it before configuring a
> provider or starting discovery, or after the documented **Reset** steps.
> Do not delete a walkthrough you want to keep merely to run this smoke; use
> the isolated deployment-path validator for release evidence instead.

```powershell
$env:HARMONIARR_DOCKER_BROWSER_SMOKE_EVIDENCE_PATH = ".tmp\docker-browser-smoke-evidence\harmoniarr-docker-smoke-browser-operator.json"
$env:HARMONIARR_DOCKER_BROWSER_SMOKE_SCREENSHOT_DIR = ".tmp\docker-browser-smoke-evidence\screenshots"
$env:HARMONIARR_WALKTHROUGH_USERNAME = "walkthrough-admin"
$env:HARMONIARR_WALKTHROUGH_PASSWORD = "HarmoniarrLocal123!"
npm run validate:docker-browser-smoke
$env:HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH = ".tmp\docker-browser-smoke-evidence\harmoniarr-docker-smoke-browser-operator.json"
npm run validate:docker-smoke-evidence
```

The deployment-path validator creates an isolated Compose project, writes JSON
evidence, and cleans up containers, volumes, and temporary bind-mount data when
the run completes. Set `HARMONIARR_IMAGE` to validate an immutable released
image, and set `HARMONIARR_BASELINE_IMAGE` to include baseline-to-candidate
upgrade evidence.

For local release rehearsals, a locally available image tag can be used:

```powershell
$env:HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR = ".tmp\docker-release-upgrade-evidence"
$env:HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH = ".tmp\docker-release-upgrade-evidence\harmoniarr-docker-deployment-summary.json"
$env:HARMONIARR_IMAGE = "ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta"
$env:HARMONIARR_BASELINE_IMAGE = "harmoniarr-walkthrough:latest"
npm run validate:docker-deployment-path
```

Use registry-authenticated immutable digest refs for final release evidence.
The validator intentionally keeps the fresh-install build path isolated from
`HARMONIARR_IMAGE`, so a released-image ref does not leak into the local image
build tag.

## Why This Exists

This walkthrough is for local exploration only.

- `compose.yaml` remains the canonical deployment baseline.
- the walkthrough keeps localhost-only port exposure and repo-local bind mounts so it is easy to throw away
- the bootstrap helper reuses the existing public route contract instead of introducing a second admin-seeding code path into the application runtime
- the helper is now explicit and disposable, so the walkthrough does not keep stale exited setup containers in the normal stack
