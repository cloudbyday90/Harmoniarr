# Missing Music Add to library outcome

Status: Implemented and validated locally
Recorded: October 3, 2026
Design: [MISSING_MUSIC_ADD_TO_LIBRARY_DESIGN.md](MISSING_MUSIC_ADD_TO_LIBRARY_DESIGN.md)
Baseline: `fddad7becf6e4fed3422752b7b512451905e1ea4`, main

## Journey and owning boundaries

This slice completes explicit canonical **Add to library** for one eligible
prepared download. Its command accepts no browser-selected candidate, path,
recipient, safety mode or quality exception. Server target resolution retains
own/administrator household scope and disabled history remains read-only.

Current-candidate facts do not require old stop history. One policy governs
permission, default action-worklist classification and guarded acceptance.
Prepared adds use the shared positive file-plan/measured-quality preparation,
short transaction and current-participant worker owners alongside recheck.
No second queue, schema migration or quality-bypass command is introduced.

The extracted native confirmation names release, artist and recipient. Explicit
confirmation starts the seventh shared command and closes the modal; persistent
pending/result feedback remains outside inert/busy content. Cancel/Escape sends
no command. Refresh and focus remain owned by the completed interaction.

## Research, alternatives and final stack

The design records URLs discovered and opened on October 3, with normative
WHATWG/IETF sources distinguished from informative W3C/OWASP and versioned
implementation guidance. Native modal feedback timing is a product choice.
Confirmation is not server authorization or a quality/collision exception.

| Recommended layer | Benefit | Cost or limit |
| --- | --- | --- |
| Vue native confirmation and existing feedback/focus owners | Explicit recipient-aware action and keyboard behavior | Browser evidence does not establish assistive-technology speech |
| Express canonical command and durable intent | Server scope and uncertain retry use existing infrastructure | UI permission still requires current owning write/worker checks |
| PostgreSQL shared atomic context/queue/required audit | Rollback cannot leave saved policy without intended work | Relevant producers must keep compatible coordination and lock order |
| Existing measured gate, durable worker and exclusive file service | Reuses the established audio/file authorities | Unverified older staging/reuse requires explicit review |
| Existing web-standards and domain skills | Maintained practices connect to concrete owners and adverse cases | References and source contracts need maintenance |

Retain Vue, Express, Node 24 ESM, PostgreSQL and existing durable workers.
Prefer shared narrow preparation/policy/transaction owners over a duplicated
legacy endpoint or another queue. The transaction/snapshot cost supports current
recipient consent and safe explicit file acquisition.

## Review and validation

Independent review identified a worker preview-before-snapshot timing gap:
provenance could change during preview and the later snapshot would compare
new state with itself. The bounded correction captures guarded current state
before fresh preview and keeps the post-checkpoint check before file mutation.
The delayed-preview unit regression and actual PostgreSQL worker case exercise
the corrected timing. The worker also verifies exact run identity and the
source-specific owning recipient marker. Older unmarked manual-add jobs are
refused before file work; there is no inferred consent, backfill or migration.

Focused final logs under ignored `.tmp/add-to-library-2026-10/` record:

| Boundary | Final passing cases | Evidence |
| --- | --- | --- |
| Backend policy, preparation, worker and owning services | 90 | `backend-focused.log` |
| Canonical route, decision projection and module | 41 | `canonical-server-focused.log` |
| Client API, presentation, command and focus owners | 44 | `client-focused.log` |
| Rebuilt browser decision journey | 19 | `browser-focused.log` |
| Prepared-add PostgreSQL/media journey | 6 | `postgres-media-add.log` |
| Existing recheck PostgreSQL/media regression | 8 | `postgres-media-recheck.log` |

These runs have zero failures/skips. Focused totals overlap broader validation
and must not be added to it. Independent read-only review reports no unresolved
material finding in this frozen prepared-add/shared-recheck scope.

The six prepared scenarios cover action paging without stop history, own and
administrator household authority, CSRF/body guards, durable replay, actual
file addition, required-audit/queue rollback, current-write drift/maintenance,
shared coalescing, current worker policy/provenance/marker refusal, and actual
unsafe-file refusal. Exact integration commands are:

```powershell
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE='harmoniarr-quality-fallback:local'
node --test test/integration/missing-music-add-to-library.test.js
node --test test/integration/missing-music-library-add-recheck.test.js
npm run validate
npm run validate:security
```

Complete `npm run validate` passes **8,776 tests**: 3,731 server, 4,348 client,
513 script and 184 integration, with zero failures, cancellations or skips.
Copyright, migration/schema, ESM, image/topology policy, test hygiene and all
lint checks pass, as do client and server builds. The complete run includes the
prepared/recheck database-media scenarios with the configured local image.
`validate.log` retains the final run. `npm run validate:security` also passes
image/topology checks and reports zero npm vulnerabilities in `security.log`;
this is dependency/policy evidence, not a whole-system security certification.

The browser run covers all five outcomes, native Cancel/Escape without POST,
uncertain-key retry, seven-command exclusion, permissions, route/disposal,
truthful queued refresh and owned focus/scroll. Scroll checks assert the
post-refresh valid range before comparing preservation. Six dialog-cropped
captures at page widths 390, 800 and 1280 in both themes were inspected; these
are confirmation captures, not full-page images or assistive-technology tests.

The local media adapter uses test-owned files mounted into a network-disabled
`harmoniarr-quality-fallback:local` container:
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
ffprobe `8.0.1`. Application, store, worker and filesystem operations execute
locally against PostgreSQL 18 fixtures. This is not published-image acceptance.

The positive addition uses actual PCM WAV under High/320 requirements and
verifies moved original bytes. Tightening the current requirement to lossless
causes worker refusal; this does not establish positive strict spectral
acceptance. Measured low-bitrate MP3 is refused at canonical preparation and
separately by the measured gate with freshly rebuilt current 320 context.
That consumer test supplies a ready plan to isolate the quality decision:
production lossy plans carry attention/transcode warnings and cannot queue via
the all-ready canonical contract. No full queued MP3 consent-revocation journey
or widened lossy acceptance is claimed. Actual collisions and differing older
staging/reuse bytes are refused while original sources remain intact.

Host tools report Node `v24.18.1` and npm `12.0.2`. Real database/file fixtures,
controlled delays/probes, browser behavior and published artifact acceptance must
be distinguished. Checks before a file operation do not make later policy
changes atomic with it or establish identity against arbitrary external byte
replacement. Actual screen-reader speech, live provider acceptance and strict
lossless spectral acceptance are not claimed. Bounded paging evidence does not
establish production-scale history/query latency.

## PR applicability, skill maintenance and next item

Fresh GitHub MCP collection/head/file checks observed the same three replayed
open PRs and an explicit empty second page. No applicable unreplayed candidate
remained; no random draw, redundant replay, downgrade or merge was performed.
The separate [applicability outcome](OPEN_PR_APPLICABILITY_ADD_TO_LIBRARY_2026_10_OUTCOME.md)
records exact identities, times, hashes and pagination limits.

The practical [web-standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now locates native modal feedback/focus timing, intentional typed form
confirmation and snapshot capture before awaited preview. Both repository and
installed structure validate; all four files
match by SHA-256. This is narrow maintenance, not a new blind skill trial.

Next recommendation: extend current recipient/policy checks to automatic
completed-download Music Queue adds. This slice defers existing unguarded
automatic work instead of adopting it. Reuse the shared worker authority, retain
physical ownership and prove revoked consent/current quality and queue races
before extending automatic acceptance.

1. Trace `download_completed` intent and define its own current automatic
   authority from discovery, participants and saved policy; do not infer explicit
   manual-add consent or reuse its owning marker.
2. Connect eligible automatic work to the shared preparation, coordination and
   worker checks without introducing a second queue.
3. Prove stale-search, disabled/unlinked participant, revoked-policy, concurrent
   queue and actual-file refusal cases before enabling that broader guarantee.

Development remains on main. No branch, tag, release, PR merge, hosted workflow
dispatch or image publication is performed by this slice.
