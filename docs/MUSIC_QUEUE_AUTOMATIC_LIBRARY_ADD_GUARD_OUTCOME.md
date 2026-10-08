# Music Queue automatic library-add guard outcome

Status: Implemented and validated locally
Recorded: October 8, 2026
Design: [MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_DESIGN.md](MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_DESIGN.md)
Baseline: `04fdbce692db2b90e65d6c5397513f943892e710`, main

## Selected recommendation and tradeoffs

Retain Vue, Express, Node 24 ESM, PostgreSQL and existing durable workers.
The narrow automatic Music Queue adapter shares preparation, short guarded
acceptance and current-policy worker owners with explicit Add/recheck.
System authority derives from saved intent and current exact participants;
explicit confirmation or another recipient's exception does not grant it.

| Recommended layer | Benefit | Cost or limit |
| --- | --- | --- |
| Persisted automatic run classification | Whole candidate-context loss cannot select generic processing for new jobs | Historical generic-source jobs with all provenance removed cannot be reconstructed |
| Shared current-scope/preparation services | Current account, relationship and quality checks reuse existing owners | Conservative refusal of stale, incomplete or conflicting scope |
| Owning PostgreSQL acceptance | Context, one scoped run and required audit roll back together | Relevant producers must preserve coordination and lock order |
| Existing measured worker/file authorities | Current policy is checked before media preparation and each mutation | No atomicity with later policy changes or arbitrary external byte replacement |
| Existing canonical recovery/status UI | Truthful queued status and guarded manual recovery without another command | Skipped prepared automatic work is not automatically rescheduled |

The [design](MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_DESIGN.md) records dated
official URL discovery, source authority, alternatives and the final stack.
Normative WCAG is distinguished from W3C Understanding and OWASP guidance.
No security certification or assistive-technology speech is inferred from code,
automated DOM assertions or dependency audit results.

## Implementation and evidence

The new automatic adapter derives current system scope and shared requirements
before preparation or blocker recovery. Explicit automatic mode reuses the
owning transaction; it atomically persists candidate context/marker, one scoped
run, required audit and a private bounded accepted authority record. The worker
reads that record from the exact owning run rather than exposing it through
public run normalization. Preferences and consent remain current rather than
being frozen in the identity record.

Worker and queued/coalescing SQL facts agree on authority identity and raw shape.
New automatic work refuses whole Music Queue context loss, marker loss, physical
owner removal or redirection, contradictory/invalid scope and stale current
participants. Snapshot capture precedes awaited preview; comparisons remain
after checkpoint persistence before each file mutation. Automatic preview and
worker quality-recovery handoffs reassert scope and compatible unchanged legacy
requirements, without widening recovery's transaction guarantee.

The existing Current status paragraph gains polite/atomic `status` semantics.
It remains inside the coherent busy snapshot; command feedback stays outside
busy content. There is no new command, status copy, layout or focus behavior.
Vue does not patch identical text; browser observation establishes DOM stability,
not whether a particular assistive technology announces speech.

Final focused client/public logs under ignored
`.tmp/automatic-library-add-2026-10/` record:

| Boundary | Passing cases | Retained evidence |
| --- | --- | --- |
| Backend adapter, guarded owners, worker and factory contracts | 115 | `backend-focused.log` |
| Canonical projection, strict queued source and privacy | 19 | `canonical-projection-focused.log` |
| Existing client API/presentation/command/focus owners | 44 | `client-focused.log` |
| Rebuilt browser journey | 20 | `browser-focused.log` |
| Dependency artwork/runtime/app/manifest consumers | 21 | `dependency-focused.log` |
| Existing prepared-add/recheck PostgreSQL/media regression | 14 | `postgres-media-existing.log` |
| New automatic PostgreSQL/media journey | 8 | `postgres-media-automatic.log` |

All have zero failures/skips. Client/test lint and rebuilt client pass on Vue
3.5.43. Browser proof uses controlled public contracts for automatic queued
progress, authority refusal, current prepared recovery and existing confirmation;
it covers coherent busy state, privacy, background focus/scroll and unchanged
poll text. Six cropped queued-status captures at page widths 390/800/1280 in
both themes were reviewed. Captures center the region and assert clearance from
fixed shell chrome; this was evidence positioning, not a layout alteration.

Independent read-only review reports no unresolved material finding in this
frozen automatic scope. The new eight-scenario run proves completed-transfer
system queueing/audit and original-byte WAV addition, queue/audit rollback,
current write drift, shared automatic/explicit races, exact run authority,
whole-context/marker/physical-owner deletion and participant retargeting, raw
authority read/coalescing/worker parity, unsafe-file refusal and current consent
consumption.

An intermediate eight-scenario run hit a PostgreSQL connection timeout during
schema bootstrap before rollback assertions. The isolated rollback scenario
then passed and the complete sequential eight-scenario rerun passed without
timeout changes or skips. Its infrastructure-failure log is retained separately;
the passing final log above is the current evidence.

The real positive path uses High/320 requirements with measured PCM WAV and
verifies original moved bytes. Queued consent revocation deletes actual stored
consent in PostgreSQL while a controlled proof-success result is awaited; the
real worker/checkpoint/file boundary refuses mutation and stale recovery.
This does not establish positive strict spectral acceptance. A separate actual
measured 320 MP3 consumer case changes from permitted saved fallback to refusal
after real consent revocation. Its ready plan is supplied to isolate the gate;
production lossy previews still carry attention/transcode warnings and are not
eligible for the all-ready canonical queue. No production lossy-ready journey
or broadened quality acceptance is claimed.

The media adapter mounts only test-owned files in network-disabled
`harmoniarr-quality-fallback:local`, image identity
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
with ffprobe 8.0.1. Application, store, worker and filesystem operations run
locally with PostgreSQL 18 fixtures. This is not app-image/published acceptance.

```powershell
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE='harmoniarr-quality-fallback:local'
node --test test/integration/music-queue-automatic-library-add.test.js
node --test test/integration/missing-music-add-to-library.test.js test/integration/missing-music-library-add-recheck.test.js
```

Complete `npm run validate` passes **8,799 tests**: 3,746 server, 4,348 client,
513 script and 192 integration, with zero failures, cancellations or skips.
Copyright, migration/schema, ESM, image/topology policy, test hygiene and all
lint checks pass, as do client and server builds. `validate.log` retains this
final repeated complete run on frozen source/dependencies. The current
`npm run validate:security` also passes and reports zero npm vulnerabilities at
every severity in `security-after.log`.

```powershell
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE='harmoniarr-quality-fallback:local'
npm run validate
npm run validate:security
```

Focused totals overlap broader
application validation and must not be added to it. Actual screen-reader speech,
live providers, strict spectral acceptance and production-scale query latency
remain unverified.

The first complete run passed server/client/script suites and 191 of 192
integration cases. An existing lifecycle test did not observe its expected
blocked transaction within the existing five-second observation window. That
case passed alone (1/1) and in its unchanged complete file (17/17); assertions,
timeouts and source were unchanged. The original failure is retained in
`validate-first-failure.log`, with focused logs `lifecycle-lock-targeted.log`
and `lifecycle-focused.log`. Its cause was not reproduced or established by
those passing reruns. The unchanged final complete run also passes that case
and all 192 integration cases. No assertion or timeout relaxation was used.

The current security gate also exposed new dependency advisories. Compatible
updates, native/functional validation and scope have their own separate
[design](DEPENDENCY_SECURITY_UPDATE_2026_10_08_DESIGN.md) and
[outcome](DEPENDENCY_SECURITY_UPDATE_2026_10_08_OUTCOME.md); combined application
validation uses those patched dependencies.

New Music Queue jobs use persisted `music_queue_download_completed` and
`automaticLibraryAddForWantedReleaseId`; the reconciliation result retains its
existing `download_completed` contract. New jobs remain guarded when their
entire candidate Music Queue context is removed. Legacy generic-source jobs
with retained Music Queue ownership refuse before file work; genuinely unrelated
generic imports keep their existing contract.

Blocker recovery remains a separately owned legacy branch. It must receive
fresh scoped authority and compatible unchanged recovery requirements; changed
floors/revoked exceptions refuse rather than propagate stale policy. This does
not make its multi-step failure/promotion/rediscovery operations one guarded
transaction. Refusal that retains a current prepared candidate can use the
existing explicit Add once active work ends. Quality failure or unsupported
stops do not gain a permissive recovery command.

## PR applicability and next item

The practical [web-standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now maps delayed automatic classification and accepted physical identity to
their owning run and adverse evidence. Source and installed structure validate;
all four files match by SHA-256. This is narrow reference maintenance, not a
new blind behavioral trial.

Fresh GitHub MCP discovery found the same three already-replayed open heads,
bases and changed-file scopes, with an explicit empty second page. The eligible
unreplayed set was empty: no random draw, redundant replay, downgrade or merge.
See the separate [PR design](OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_DESIGN.md)
and [PR outcome](OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_OUTCOME.md).

Next recommendation: guard fallback recovery's policy handoff through its
owning writes. Define explicit override removal and numeric-floor propagation,
then coordinate failure/promotion/rediscovery with current participant scope.
Prove changed consent, disabled/unlinked recipients and delayed recovery races
before broadening automatic retry guarantees.

Development remains on main. No separate branch, tag, release, PR merge,
workflow dispatch or image publication is performed by this slice.
