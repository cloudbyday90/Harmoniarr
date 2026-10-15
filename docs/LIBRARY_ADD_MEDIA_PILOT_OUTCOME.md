# Canonical library-add media pilot outcome

Date: 2026-10-15. Implemented directly on main; no release or tag.

## Delivered behavior

One narrow ESM module scopes stable app/seed adapters to the actual fresh child
directory in `missing-music-add-to-library.test.js`. Each opted-in scenario owns
an independent existing API inspection executor. The child predicate awaits
canonical close after app/worker drainage, then requires verified safety and
any caller predicate. Fallback close handles earlier runtime failure. Adapters
cannot overlap or be reused before the returned database tail settles.

Per-command remains default. Every original business test body/assertion is
preserved apart from the call to the wrapper. Generation remains writable and
per-command. All inspections remain current; no inspection, current-byte or
delivery guard was removed and no production service or database schema changed.

## Reproduction

With an already available reviewed media image, scope these environment values
to the test process and restore them afterward:

```powershell
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'harmoniarr-quality-fallback:local'
$env:HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION = 'owned-api'
$env:HARMONIARR_LIBRARY_ADD_MEDIA_DIAGNOSTICS = 'on'
node --test --test-concurrency=1 test/integration/missing-music-add-to-library.test.js
```

Choose `per-command` for the comparator; omit diagnostics for ordinary use.
For the focused selection, insert
`'--test-name-pattern=no-stop-history prepared download'` before the literal file.
Invalid modes and an imageless API selection reject before PostgreSQL startup.

## Focused reversed-order collection

Same code, literal file and canonical real-file case, serial execution. Every
sample generated one file and performed four real inspections. All passed with
zero skips. Scenario duration includes its database/child cleanup tail and
executor close; command duration additionally includes suite/prerequisite setup.

| Order | Mode | Command seconds | Scenario seconds | Executor close ms |
| --- | --- | ---: | ---: | ---: |
| 1 | Per-command | 52.159 | 11.802 | No owner |
| 2 | Owned API | 18.526 | 10.186 | 718.474 |
| 3 | Owned API | 16.003 | 9.029 | 620.392 |
| 4 | Per-command | 16.567 | 9.421 | No owner |

The first command's large setup difference is not attributable to inspection
execution. The reversed pair is close, so these samples do not support a large
four-inspection speed claim. Each owned sample recorded 13 transport CLI calls
and 15 GETs, in addition to unchanged generation/prerequisites. All fixed
observations completed without failure, pending work, clipping or untimed clocks;
owner cleanup was verified true. Per-command transport phases were not observed
and must not be reported as zero native launches.

The controlled image was
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
with ffprobe 8.0.1. Host Node was 24.18.1; Docker Engine was 29.8.2/API 1.56.

## Complete owning cohort

The six-case API cohort passed in 53.460 seconds; the following per-command
cohort passed in 72.670 seconds. Both generated eight actual files and executed
27 ffprobe inspections, distributed 4/0/0/0/11/12 across the same scenarios.
The three SQL-only scenarios created no native media owner. The three media
scenarios each created and safely removed one owned container.

The 11-inspection case measured 14.169 versus 19.662 scenario seconds; the
12-inspection refusal case measured 14.911 versus 29.003. The four-inspection
case went the other way: 10.110 versus 9.377 seconds. This one complete pair
observed a 19.210-second reduction overall, with host/setup variation included.
It is not a repeated complete-cohort estimate or whole-CI speed claim.

Coverage retains outsider/CSRF rejection, canonical paging and permissions,
stable replay/coalescing, actual worker completion, codec measurement, exact
delivered bytes/source removal, required audit/queue rollback, current snapshot
drift, shared recipients, mid-preview provenance change, strict policy/unmarked
legacy refusal, low media, collisions and differing staging/reuse bytes.
No receipt contract or other cohort's private comparison changed.

## Validation and maintained skill

Six focused tests passed. They prove conservative option selection, existing
local/per-command behavior, held close after app drainage, serial admission
through a held database tail, one canonical close, optional sink failure and
actual directory retention through failed close plus original Error/null. A
healthy same-name sibling cannot clear child/parent retention; successful work
cannot turn failed or nonboolean cleanup into permission.

The frozen final code passed `npm run validate:fast` in 183.090 seconds:
5,255 server, 4,384 client and 568 script tests, totaling 10,207, with zero
failures/skips. Static policy, lint and both builds passed. The production-only
dependency audit reported zero vulnerabilities. The complete native cohort
passed in both modes as recorded above; no full integration/scaling matrix was
automatically repeated. A private source comparison confirmed all six original
business test bodies/assertions are unchanged apart from the wrapper call.

The maintained standards/testing skill references now map this explicit rollout
to Docker ownership, Node returned completion, W3C draft monotonic timing and
OWASP fixed output. This updates the existing practical skill instead of adding
an overlapping checklist. Structural validation and installed-mirror checks are
reported separately from behavioral proof; no new blind skill trial is claimed.

Both repository skills and the installed standards skill passed structural
validation. All four standards mirror files matched byte-for-byte. Source
freezes and staged/older-baseline checks protect the unchanged runtime, media
transport, private comparators and production code.

Initial and final GitHub MCP collection reads returned zero open PRs. No
applicable random PR existed; no PR patch, rebase, merge or comment was performed.

## Local no-cache rebuild

Followed the [walkthrough's clean rebuild sequence](LOCAL_DOCKER_WALKTHROUGH.md):
`build --no-cache harmoniarr` succeeded in 44.287 seconds, followed by
`up -d --wait --no-build harmoniarr` and the disposable bootstrap profile helper.
The service is running and healthy on `127.0.0.1:47956`; `/healthz` returned 200.
Bootstrap confirmed the existing admin, and existing walkthrough data was kept.
This is packaged startup evidence. Conditional provider/download scenarios and
fresh-state browser/release validation were not repeated or claimed.

Private frozen source, raw native logs, summaries and gate evidence remain
ignored under `.tmp/library-add-media-pilot-2026-10-15/`.

## Recommendation stack and next item

Keep guarded reusable runtime ownership, explicit scenario-scoped API selection,
reviewed local GET reader plus CLI lifecycle, unchanged canonical current-file
checks, fixed diagnostics and focused validation. The advantage is fewer media
container starts in inspection-heavy scenarios. The cost is bootstrap/lifecycle
overhead, privileged local daemon access and deliberately retained evidence on
uncertainty. More CLI calls can coexist with fewer container starts.

Next collect one reversed-order complete cohort pair on a quiet host before
deciding whether this cohort should default to owned API inspection. Keep broader
cohort adoption, full Linux media lifecycle proof and Engine exec/lifecycle API
migration separate. Existing defaults, resource bounds and historical incomplete
large-workload evidence remain unchanged. See the separate
[design](LIBRARY_ADD_MEDIA_PILOT_DESIGN.md) and
[official research/options](LIBRARY_ADD_MEDIA_PILOT_RESEARCH_2026_10.md).
