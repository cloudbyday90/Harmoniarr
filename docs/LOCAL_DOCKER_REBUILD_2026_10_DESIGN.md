# Local walkthrough rebuild and validation

October 10, 2026. Follow-up requested after the catalogue work completes.
Source: the full [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) and separate
[official Docker research](LOCAL_DOCKER_REBUILD_RESEARCH_2026_10.md).

## Build and preserve the local deployment

Finish the frozen-source validation and publish the reviewed changes on main
first. Then create a uniquely named, positively acknowledged Buildx
`docker-container` builder with `default-load=true`, without selecting it globally.
Run the guide's `compose.walkthrough.yaml build --no-cache harmoniarr` with
`--builder` pointing to that invocation-owned builder. Capture the loaded image
ID and verify removal of the owned builder/container/state volume afterward.
No global cache pruning is needed.

`--no-cache` bypasses layer reuse; Dockerfile npm cache mounts can survive that
flag. A new builder isolates previous mount state too. Stages can still share
cache populated within this build, so this is prior-state isolation rather than
a claim that every command starts with an empty package directory. Base-image
pull policy is separate; retain the repository's pinned defaults and record
actual image/runtime versions instead of assuming host/image parity.

Run the documented `up -d --wait --no-build harmoniarr`, then the one-shot
bootstrap profile `run --rm --no-deps walkthrough-bootstrap`. Preserve existing
walkthrough bind data and deployment secret settings. The helper reuses an
existing administrator. Verify that the running container uses the newly built
image, is healthy, binds `127.0.0.1:47956`, and retains its non-root/read-only/
capability/no-new-privileges settings. Leave the rebuilt walkthrough available.

## Follow the applicable guide branches

The guide's Reset, provider configuration/real transfers and release-rehearsal
sections are conditional. A rebuild does not require deleting walkthrough data,
selecting a provider match, submitting a transfer or publishing a release.

- Run the account-free managed-provider smoke with the rebuilt local image and
  no build. Its separate temporary project restricts provider egress.
- Run file-backed Music Queue recovery with that same image, generated media,
  provider stub and fresh bind directories. Verify owned project cleanup.
- Probe preserved walkthrough readiness with its existing credentials supplied
  through a password-only file. It signs in and may read provider download
  status; no search/transfer command or provider-configuration save is submitted.
  Configured-provider/path-mapping requirements remain strict. Missing setup is
  reported as missing setup, rather than a passing acceptance proof.
- Use the guide's isolated canonical deployment path for fresh-state proof when
  the walkthrough is already configured. Keep its independent source-build
  validation and supplied-image validation. Inject the existing native browser
  smoke at the supplied image's fresh-install boundary, after bootstrap and
  before request/backup flows create notifications. Verify its evidence with
  the existing smoke-evidence verifier. Browser backup creation stays isolated.

Strict accepted-transfer/Music Queue-link proof applies only to existing
operator-started transfers. Provider acceptance, mounted/path-mapped import
readiness and container health are separate results. Do not invent credentials,
downloads, release artifacts or a baseline image to satisfy a conditional branch.

## Recommendation and evidence

| Approach | Benefit | Cost or limit | Selection |
| --- | --- | --- | --- |
| Existing builder with `--no-cache` | Short guide command | Persistent npm mount state remains | We use a new owned builder |
| Fresh builder plus `--no-cache` | Isolates earlier layer/mount state | Builder startup and downloads | Selected |
| Global cache prune or walkthrough Reset | Removes broad state | Impacts unrelated builds or existing data | Unnecessary |
| Preserve walkthrough plus isolated canonical/browser proof | Keeps configured exploration and proves fresh paths | Additional temporary projects | Selected |

Task-only ESM orchestration under `.tmp/local-docker-rebuild-2026-10/` composes
existing validators without a new platform service or permanent test framework.
Use explicit local image identity, private child environments and temporary
password-only files; keep keys/passwords out of arguments, terminal output and
committed evidence. Positive resource identities own cleanup; verify absence and
preserve the primary failure. Separate outcome/evidence will record actual build,
health, provider readiness, browser/packaged results and cleanup limits.

## Validator contract migration

Downloader navigation starts an asynchronous queue load. Observe the mounted
same-origin GET and successful coherent payload, then the Transfer Queue card's
matching rendered count before the validator exercises its filter. Scope rows,
status and counts to that card. This defines a validator snapshot; it does not
require users to wait before interacting with native controls. Run-history
diagnostics use an eyebrow label and strong title, not a heading. Check both in
one visible diagnostic article within the native disclosure; repeated labels
elsewhere cannot satisfy it. One panel does not prove every run item/provider file.

Quality fixtures retain the real owner and native verification. First prove
actual below-policy media is refused before automatic queueing, with source bytes
retained and no apply item. A separate worker control admits genuine valid media
through current preflight, then changes only the acknowledged disposable source
before startup. Verify its fresh native quality reason, durable state, preserved
source and absent destination. An earlier authority/source refusal is not proof
of the later verifier. Keep actor/recipient/source/run/quality fences intact;
fixture adaptation must not bypass authorization or substitute injected success.

| Choice | Benefit | Limit / selection |
| --- | --- | --- |
| Owning DOM helper and native measured-media fixtures | Checks mounted/panel/current-policy contracts | Selected validator work; package execution still required |
| Larger timeouts or invented heading roles | Small edits | Hide the observed boundary; reject |
| Action-owned app announcement update | Aligns visible/live counts after delayed load | Separate application follow-up with browser evidence |

## Observed application follow-up

Retained `live-ui-diagnostic.json` shows visible **12 of 859** transfers while
status remains **0 of 0** after a filter change before load. `DownloaderView.vue`
snapshots its computed label only in filter handlers; `useAsyncResource` later
changes queue data without completing that announcement. A loaded-validator wait
does not fix this application behavior.

Propose a pending announcement owned by the latest explicit filter action. If
initial queue data is absent, complete it after successful mounted load using
current visible counts. Superseded actions, failed loading and unmount must not
publish a stale result. Keep the persistent polite/atomic region and usable
controls, preserve focus and avoid periodic-poll announcement noise. Cover delayed
load, rapid filters, empty/error outcomes and unrelated refresh. DOM assertions
do not prove assistive-technology speech/full conformance. This app fix is outside
the validator work.

The stack remains Vue/native semantics, narrow ESM DOM adapters and existing
owner/media/packaged validators. Root's outcome separates failed attempts,
corrected fixtures, executed packaging and the unresolved app follow-up. No
passing result is preclaimed while packaging checks are pending.

Executed results, source continuity and publication scope are recorded in the
separate [outcome](LOCAL_DOCKER_REBUILD_2026_10_OUTCOME.md).
