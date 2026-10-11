# Local walkthrough rebuild outcome

October 10, 2026, America/New_York. Follow-up to the published catalogue slice
(`13e47b68`), the [rebuild design](LOCAL_DOCKER_REBUILD_2026_10_DESIGN.md) and
[official Docker research](LOCAL_DOCKER_REBUILD_RESEARCH_2026_10.md).

## Rebuilt walkthrough

The guide's no-cache build, `up -d --wait --no-build`, and disposable bootstrap
profile ran. The configured walkthrough remains available at
<http://127.0.0.1:47956>. Existing data, mounts and deployment settings were
preserved; the bootstrap helper reused its existing administrator.

The build used a new invocation-owned `docker-container` builder with
`default-load=true` and `--no-cache`. It took **262.783 seconds** and loaded
`harmoniarr:walkthrough-local` with image ID
`sha256:8bb75f7203b19ca27327a627092699b7f89e3ed121d3e7e74f63ed9b842ed892`.
The running container uses that exact image. Builder, BuildKit container and
state-volume absence were verified afterward; the selected `desktop-linux`
builder was unchanged. Prior builder state was isolated; reuse of npm cache
newly populated within this build remains possible. No global prune or base-image
`--pull` was performed.

The container is healthy, binds only loopback port 47956, runs as non-root, has a
read-only root filesystem, drops all capabilities and retains
`no-new-privileges`. Host tools: Docker 29.8.2, Compose 5.5.1, Buildx 0.37.2,
Node 24.18.1 and npm 12.0.2. Actual image tools: Node 24.21.0, npm 12.0.2,
FFmpeg 8.0.1 and PostgreSQL client 18.6. A separate live `SHOW server_version`
returned **18.6**; that server value was not inferred from the client version.

## Preserved provider and applicable guide branches

Readiness-only passed with configured provider and download mapping requirements
retained. The strict existing-transfer/Music Queue-link proof then passed:
**12 linked of 859 current transfers**, preserved after native filtering and
refresh. There are 774 completed and 85 failed transfers, with no active or
queued transfers at this observation. Provider health is **attention**, not a
claim that every transfer/import is healthy. Eight retained download diagnostics
include seven `no_unlocked_files` and one `provider_accepted`; the latter's bounded
accepted count is zero, so acceptance also relies on the existing completed
Downloader transfers rather than inventing a new receipt.

The checks signed in and read provider status. They submitted no searches,
transfer commands, match selection or provider-configuration saves. Authentication
can create session, last-login and audit records. Existing provider/background
activity is outside a claim of zero I/O. Password-only files were outside the
repository and their owned removal was verified.

The separate managed-provider smoke passed: rendered configuration mode 600,
remote configuration disabled, provider egress isolated, no published provider
API port, private API HTTP 200 and healthy Harmoniarr/provider. Its project,
containers, networks and volumes were independently confirmed absent afterward.
It establishes account-free startup/private API access, not real Soulseek login,
search or download.

The packaged file-backed proof **passed all seven controls**: authentic media
added; disguised/transcoded media blocked; collision blocked; repaired folder
mapping resumed only the affected release; restored media tooling resumed only
the affected release. Project resources and the owned workspace were verified
absent. Real generated media and isolated PostgreSQL/provider fixtures were used;
the configured provider and operator library were not used for this proof.

The configured walkthrough was preserved. The guide's fresh-browser assumptions
were exercised through isolated canonical deployment validation instead of
resetting it. Reset, new real downloads and optional baseline-to-release upgrade
were conditional branches; no baseline image or release was invented.

## Validator corrections and retained failures

The first task-only builder attempt used unsupported `buildx inspect --format`
and failed before building. Its positively acknowledged inactive builder was
removed, with no matching container or state volume. The corrected adapter reads
actual `buildx ls` node identity and plain `inspect --bootstrap`, without changing
the globally selected builder. Both attempts remain in local evidence.

Strict provider automation initially failed on eight repeated diagnostic labels,
then an obsolete Music Queue checkbox name, then the loaded queue's status count.
The narrow ESM DOM helper matches the exact label and strong title within one
visible diagnostic article. It captures the mounted queue GET before navigation
and waits for its successful response and exact loaded subtitle before activating
the Missing Music filter. Original-to-mounted and mounted-to-refreshed linkage
identity checks, row counts, checked state and native 15-second bounds remain.
Four real Chromium diagnostic controls cover repeated/hidden panels, split
label/title and message decoys. Two delayed-load controls distinguish premature
filtering from the loaded-snapshot proof. These controls do not establish full
application accessibility or assistive-technology speech.

The actual application still has a reproduced follow-up: filtering before async
data arrives can leave `role=status` saying **Showing 0 of 0 transfers.** while
the visible subtitle says **Showing 12 of 859 transfers.** and twelve rows render.
Waiting for mounted data makes this validator's ordinary loaded journey precise;
it does not fix the application's early interaction. Preserve that finding.

File-backed automation first omitted the current completed-transfer accepted
observation, then started the worker with hardcoded arguments that overwrote its
persisted scope. The fixture now captures the saved candidate/files, retains the
actual execution item/run DTO and forwards the saved one-candidate apply-run
scope. A later failure exposed its stale worker-only quality expectation: the
application now rejects disguised media during prequeue verification. The revised
proof requires no run/item, review state, no library target and unchanged source
bytes at preflight. It then admits actual valid FLAC through the real owner,
restores only the task-owned disguised bytes before worker startup, and retains
the original blocked/failed/no-library assertions. Persisted spectral
suspicious/transcoded evidence is required, excluding unavailable-tooling errors.
No eligibility, provider receipt or production guard was fabricated or bypassed.
The same original full packaged command passed after these fixture corrections;
all earlier failing logs and cleanup results are retained.

The initial narrow browser repro accidentally omitted the HTTP flow option that
performs first-admin bootstrap, so it correctly reached first-run setup instead
of login. That task-only setup was corrected before assessing browser selectors.
Original failure artifacts remain; failed proof never became passing evidence.

The smoke journey's retired Downloader copy, Activity navigation and recovery
labels were aligned with current source. It uses the native Advanced diagnostics
disclosure for Background Jobs and Match diagnostics, More settings for Backup
& restore, and explicit Review restore/file-actions disclosures for compatibility
and download visibility. All nine checkpoint keys, quiet-startup API assertions,
the exact one disabled queue GET over 5.5 seconds and original timeouts remain.
It creates a disposable backup; it does not click Apply restore or Download.
The bootstrapped minimal packaged browser replay passed all nine checkpoints.

The full canonical deployment replay then **passed** for both an independent
source-build fresh install and the supplied rebuilt local image. Both verified
schema bootstrap, zero pending migrations, existing-data restart, embedded
database persistence, backup compatibility/apply and maintenance-lock conflict,
delegated Request Music attribution/visibility and expected startup refusal.
The supplied image's fresh boundary also passed nine operator browser checkpoints
with nine screenshots. Native smoke-evidence verification passed for fresh
install, supplied-image and browser artifacts. The validator's historical
`releasedImage` slot contains the explicit local image ID here; no released
image was published. The optional upgrade path was explicitly skipped because
no baseline was configured.

Both final projects' containers, networks and volumes and both owned workspaces
were independently verified absent; the generated password file/directory were
also removed. The initial rejected deployment had no aggregate result, so its
adapter's default `projectCleanupVerified=false` was incomplete certification,
not an observation of a leaked project. The passing replay retains exact owned
cleanup records independently of its aggregate.

## Validation and publication scope

The prior stable catalogue candidate passed the complete `npm run validate`:
**9,901 tests**, all static/lint checks and both builds, zero failures,
cancellations or skips. Its 24m28s wall time does not establish a whole-gate
performance improvement. The later Docker validator/fixture corrections require
their own focused and packaged evidence; the earlier aggregate does not cover
later edits. No application, Dockerfile, Compose or dependency source changed
after that image build.

After the validator candidate was frozen, the complete script suite passed
**552/552** and the focused DOM/provider/browser-script group passed **26/26**,
zero failures/cancellations/skips. Scoped ESLint, copyright, ESM consistency and
test-hygiene checks passed. The real file-backed command and preserved strict
provider command passed on the rebuilt image. The existing smoke script's mixed
line endings were normalized before this final focused/script and canonical
validation; normalized content identity is recorded separately. Repeating the
24-minute PostgreSQL aggregate for these host-side validator changes would not
add evidence about the changed DOM/media seams.

The standards AI skill's two references now map mounted-response/panel ownership,
actual preflight versus worker quality verification, and the unresolved async
status finding. Source and installed skill structural validation passed;
entrypoint, metadata and invocation policy are unchanged. This is narrow
reference maintenance, not a new blind skill trial or WCAG certification.

The fresh GitHub MCP refresh observed three open PRs and an empty terminal page;
all immutable head/base pairs and complete one-file scopes still match their
prior local replay records. There was no eligible unreplayed patch or random
draw. See the separate [PR outcome](OPEN_PR_APPLICABILITY_CATALOGUE_LIFECYCLE_2026_10_OUTCOME.md).
Work remains on main, with no new branch, tag, PR merge or release.

## Evidence location

Task-only ESM orchestration, red/green logs, bounded JSON and browser screenshots
are under `.tmp/local-docker-rebuild-2026-10/` and remain local. Primary artifacts:
`no-cache-build-fd85fd88-fe98-4bd7-aaa9-b9d3bd4213ee.json`,
`walkthrough-up-evidence.json`, `runtime-versions.json`, `managed-smoke.json`,
`provider-readiness.json`, `provider-linked-acceptance.json` and
`live-ui-diagnostic.json`, plus `file-backed-evidence.json`,
`deployment/deployment-summary.json`, `deployment/owned-cleanup.json`,
`final-runtime-evidence.json`, focused/script/static logs and frozen source hashes.
The separate official research records MCP-discovered
sources and their raw response hash. Secrets, raw provider payloads and media
were not committed as evidence.

The final local evidence manifest records **100** retained log/JSON/screenshot
files: `.tmp/local-docker-rebuild-2026-10/validation-evidence-final.json`.
SHA256: `57b0b9939dfc27e9d84c6237f74a560af97070396cded5a961e69862138bdac9`.
Publication continuity is recorded separately: all five frozen code hashes match,
all four maintained installed skill files match, and 370 local Markdown links
resolve across eleven changed documents. No Dockerfile/application/image input
changed after rebuilding; validator fixtures are copied into disposable targets
and browser orchestration runs on the host.

## Recommended follow-up

First fix the confirmed early-filter status message at the application owner:
retain the user's selected filter and announce its final loaded result after
that pending interaction, without moving focus or making routine background
polling announce repeatedly. Prove delayed success, failure, navigation and
superseded filter choices in the actual Vue journey; DOM assertions alone do not
prove screen-reader speech. Then capture first app-pool checkout diagnostics
before promoting the audited PostgreSQL cohort into an exhaustive full-gate
dispatcher. The [catalogue outcome](CATALOGUE_TEST_LIFECYCLE_OUTCOME.md) retains
the unchanged first-checkout failures and the limited timing evidence.
