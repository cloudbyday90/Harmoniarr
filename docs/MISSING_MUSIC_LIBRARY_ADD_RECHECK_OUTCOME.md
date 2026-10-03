# Missing Music library-add recheck outcome

Status: Implemented and validated locally
Recorded: October 3, 2026
Design: [MISSING_MUSIC_LIBRARY_ADD_RECHECK_DESIGN.md](MISSING_MUSIC_LIBRARY_ADD_RECHECK_DESIGN.md)
Baseline: `af7336013e58ebd3524e2e08c11b6009380335bc`, main

## Delivered journey

Missing Music now exposes **Check the files again** for the current recipient's
eligible completed download after folder or media-tool repair. An administrator
can repair folders, return to the same recipient's decision, and explicitly
recheck. Saving Settings makes no automatic legacy or canonical recheck request.
Media-tool guidance does not invent an installer in Media & storage.

The canonical POST accepts no additional body fields, resolves recipient scope
on the server, and uses fresh session, CSRF, rate limiting, and the existing
durable mutation contract. The six bounded outcomes distinguish acceptance,
existing work, an unresolved prerequisite, review, unavailable work, and deferral.
Queued feedback promises checks, not completed library addition.

The extracted recovery panel and recheck composable share the inspector's six
command gate, persistent status feedback, and uncertain-retry intent. A browser
regression exposed an existing offscreen focus destination after a lower-panel
command. Successful interaction-owned completion now permits normal focus
scrolling; user-moved focus and background refresh preserve both focus and scroll.

## Architecture and security decisions

- A narrow acquisition policy owns the allowed recovery reasons, permission,
  exact queued membership, and public recovery facts. Projection suppresses
  unavailable legacy next actions. Public recovery contains only allowlisted
  reason, queued state, and nullable run identity.
- Preparation regenerates a nonempty ready plan and measured-quality evidence
  outside write locks. Any keeps its existing quality semantics while still
  requiring files and a safe plan.
- Recheck retains the downloaded candidate's saved requirement and applies any
  stricter current participant floor. Exact original/current recipient sets must
  agree; disabled, resolved, ignored, or unlinked participants conservatively stop
  this recovery. Consent does not expand to a newly linked recipient.
- The guarded transaction rereads recovery, participant policy, candidate/files,
  and saved decisions. It commits resume, recovery event/audit, scoped safe-auto
  operation, and operation-start audit together. Unrelated active apply work
  defers without reopening the candidate; exact current work coalesces.
  File-decision writers now lock the candidate before validating status or mutating
  children, matching the snapshot guard's order and removing a lock inversion.
  Batch ingestion locks already-existing parents in ID order before replacing
  files. Default recovery promotion uses the shared discovery selection guard
  before its conditional update, so a competing promotion cannot bypass that
  acceptance boundary.
- A common apply queue service coordinates all apply starters with the same
  maintenance/advisory/candidate transaction boundary. Existing generic start
  conflicts remain conflicts. No second queue or schema migration was added.
- Recheck workers refresh current policy and compare the snapshot again before
  each filesystem mutation, after checkpoint persistence. Safe-auto operations
  refuse older staging, checkpoint recovery, and reusable alternate inputs;
  fresh staging from the checked download remains supported. Manual operation
  behavior retains its existing review contract.

First-party additions use ESM and separate policy, store, transaction, command,
presentation, and composable responsibilities. Existing operation, quality,
exclusive filesystem, audit, and retry owners remain authoritative.

## Official practices and recommendation stack

The design records primary URLs discovered and opened on October 3, their source
authority, and applicability. W3C keyboard/status/focus/link guidance informs the
native control and bounded Settings return. OWASP informs server object authority,
CSRF, and internal route context. IETF informs explicit POST and durable retry;
PostgreSQL informs the coordinated transaction. Node's exclusive-copy behavior
does not establish input identity or make a copy atomic.

| Recommended layer | Benefit | Cost or limit |
| --- | --- | --- |
| Vue native controls, persistent feedback, owned focus | Keyboard behavior and truthful async progress in the existing UI | DOM/browser evidence does not prove screen-reader speech |
| Express canonical commands with server scope and durable intent | Replays and recipient authority use existing infrastructure | Eligibility must remain current at owning write/worker boundaries |
| PostgreSQL atomic resume/queue/required audit | Failures cannot leave reopened work without its intended operation | All starters must retain the shared coordination and lock order |
| Existing measured gate and exclusive filesystem service | Reuses the established audio and file-plan owners | Safe-auto alternate staging/reuse now requires explicit review |
| Narrow standards skill alongside domain skills | Connects practices to actual owners and adverse cases | Official references and current contracts need maintenance |

Retain Vue, Express, Node 24 ESM, PostgreSQL, and the durable workers. Prefer this
explicit canonical journey over automatic Settings acquisition or another recovery
queue. Its additional transaction/snapshot work is justified by the previously
nonatomic reopen/start and stale input/policy boundaries.

## Validation

Complete `npm run validate` passes on stable source: **8,745 tests**, comprising
3,714 server, 4,340 client, 513 script, and 178 integration tests, with zero
failures, cancellations, skips, or todos. Copyright, migration ID/filename,
schema snapshot, ESM, image/topology policy, all lint and test-hygiene checks,
and both client/server builds pass. The configured media scenarios execute in
this full run. Log: `.tmp/library-add-recovery-2026-10/validate.log`.

Focused evidence also passes; these groups overlap broader validation:

- 90 focused server tests, plus 35 final recovery/promotion/selection/store
  tests, zero failures/skips. The separate route/projection/module group passes
  34 tests. These totals overlap and are not added together.
- Eight real PostgreSQL/local-media scenarios, zero failures/skips: repaired
  folders through the canonical HTTP command to actual worker/file application;
  low-bitrate and collision refusal; differing staging and reusable input refusal;
  both required-audit and queue-creation rollback; concurrent coalescing; current
  participant/policy/link and file/decision checks; compatible decision/ingestion
  lock order; and recovery promotion versus recheck in both winner orders.
  Promotion coverage includes current and older searches, ownership-only metadata,
  and blank-search metadata scope. A separate promotion run also passes.
- 60 focused client tests, zero failures/skips, including six-command exclusion.
- 15 rebuilt browser scenarios, zero failures/skips: six outcomes, same-key
  uncertain retry, permission/read-only hiding, refreshed detail/worklist, Settings
  return with no automatic mutation, keyboard, visible owned focus, and preserved
  user/background focus and scroll.
- Client/test lint and client build pass. Six panel captures at 390, 800, and
  1280 pixels in both themes were inspected under the ignored
  `.tmp/missing-music-library-add-recheck/` directory.
- `npm run validate:security` passes image/topology policy and reports zero npm
  audit vulnerabilities; log: `.tmp/library-add-recovery-2026-10/security.log`.
- Independent source review of the frozen runtime reports no unresolved material
  finding within this slice. The staged patch passes `git diff --cached --check`,
  and all 110 local links in its eight Markdown documents resolve.

Backend evidence is retained in `server-focused.log`,
`recovery-promotion-focused.log`, and `postgres-media-focused.log` under the
ignored `.tmp/library-add-recovery-2026-10/` directory. The focused integration
command is `node --test test/integration/missing-music-library-add-recheck.test.js`
with `HARMONIARR_INTEGRATION_MEDIA_IMAGE=harmoniarr-quality-fallback:local`.
The local fixture image is
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
with logged ffprobe `8.0.1`. PostgreSQL uses `postgres:18-alpine`; host media tools
are absent, so the configured adapter runs media tools in the local image while
the production application/store/worker and file operations run on the host.
Actual successful addition uses the High320 profile and PCM WAV bytes, not strict
lossless spectral acceptance. Existing staging and reusable library files are
real adverse fixtures; late reuse between the two lookups is an operation-unit
simulation. The ingestion race covers already-existing parents, not concurrent
new-row insertion.

Host validation uses Node `v24.18.1` and npm `12.0.2`. Actual screen-reader speech,
strict-lossless spectral acceptance, live provider acceptance, production-scale
history latency, and published artifact acceptance are not claimed. Checks
immediately before mutation do not make subsequent policy changes atomic with an
already-started filesystem operation, or protect against arbitrary external
replacement of original/fresh staging bytes.

## PR applicability, skill maintenance, and next item

Fresh GitHub MCP collection and immutable head/file checks found three open PRs,
all unchanged from their earlier local replays. The eligible unreplayed set is
empty; no random draw, downgrade, redundant implementation, or merge occurred.
The [separate applicability outcome](OPEN_PR_APPLICABILITY_2026_10_OUTCOME.md)
records the snapshot, hashes, and collection-coverage limits.

Independent review identified the preview-source versus actual staging/reuse
input gap. The [web-standards skill outcome](WEB_STANDARDS_SKILL_OUTCOME.md)
records one evidence-map maintenance entry, successful structural validation, and
four-file installed identity. This observed case improves the practical skill
without adding a general compliance checklist.

Next: canonical guarded **Add to library** for an already prepared eligible
download. Reuse the atomic apply queue and final-input safeguards, extend current
recipient/policy checks to that command, and prove its distinct confirmation,
permission, replay, and refresh contract before exposing it. Keep collision and
quality-bypass decisions separate from this recovery action.

This is development on main. No release, tag, PR merge, hosted workflow dispatch,
or image publication is performed by this slice.
