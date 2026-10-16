# Complete PostgreSQL cohort comparison outcome

Date: 2026-10-15. Work stays on main without a release, tag, branch or PR merge.

This records the original five-file collection and its frozen source. The
current seven-file allowlist/CLI is documented in the separate
[recovery shared-cohort outcome](RECOVERY_SHARED_COHORT_OUTCOME.md); its results
do not relabel the historical measurements below.

## Delivered implementation

`npm run measure:postgres-cohort` runs the complete existing five-file allowlist
as isolated/forward, shared/forward, shared/reverse and isolated/reverse profiles.
It retains native serial file processes, independent scenario databases, current
assertions and existing parent registration/release. Default scheduling is
unchanged. The runner's additional reporter is an explicit boolean opt-in; its
normal command remains unchanged.

Small ESM policy, evidence and comparison modules own environment/source identity,
bounded parsing/comparison and execution respectively. The CLI owns prerequisites
and fresh ignored artifacts. Native reporter events supply cumulative counts and
hashed source/name/outcome identities rather than parsing human spec summaries.
Only thirteen selected fixture phases are aggregated; durations are inclusive.
Parent startup/stop comes from the actual parent observer, not a synthetic phase.

Both images must be verified immutable Linux image IDs, supplied through
HARMONIARR_INTEGRATION_POSTGRES_IMAGE and HARMONIARR_INTEGRATION_MEDIA_IMAGE.
The command checks identities and ffmpeg/ffprobe before PostgreSQL work, copies
the environment, clears inherited PostgreSQL/parent/Node-runner and integration
overrides, then selects default schema/bounds with fresh ownership and timing on.
It leaves the caller's environment untouched. Current source hashes are checked
outside timing before/after every sample, including unignored new code.

Use an already inspected media fixture image and resolve the intended PostgreSQL
image with `docker image inspect <image> --format '{{.Id}}'`; set those two IDs
for the command's scope and restore the previous variables afterward. Artifacts
are written to a fresh `.tmp/postgres-cohort-comparison-*` directory. Ignored logs
may contain ordinary native output and have no new Windows ACL guarantee.

Missing/duplicate evidence, changed cases/work, skips/TODOs, source drift or
unreleased/reaped registrations refuse a completed comparison. Returned output,
actual fixture release and final log closure are awaited. Original Error/null
survives later artifact failure. No retry, force-exit, larger pool, added worker,
dependency or production service/schema change is introduced.

## Executed evidence

The final focused gate passes 39 tests with zero failures/cancellations/skips in
1.465 seconds. It covers copied/sanitized configuration, fixed profile/file order,
held artifact completion, Error/null, missing/duplicate/skipped/changed/native
evidence, source drift, registration cleanup and bounded split-UTF-8 framing.
A real installed-Node reporter control verifies cumulative counts versus suites,
approved phase capture, omitted raw name canaries and deliberate skip refusal.

The first development gate failed three controls: two exposed an unobserved
Writable error event after a rejected write callback, and the native reporter
control retained NODE_TEST_CONTEXT as an empty string. The wrapper now observes
that error event while preserving write-callback authority; the native control
removes the inherited key, matching the existing process adapter. Initial
development failures remain separate from final evidence. Changed JavaScript
lint passes before the source freeze.

The frozen four-profile native comparison passes all 176 test executions: the
same 44 cases in each profile, zero failures/cancellations/skips/TODOs. Each
profile creates 107 databases, drops 103 scenario databases and four templates,
prepares four templates, and records 89 schema/scenario spans. Case/outcome
signatures and compared phase counts/failures match. Each shared profile registers
107 resources, releases all 107 and reaps zero after actual child completion.
Both isolated profiles verify five successful starts/stops; each shared profile
verifies one successful parent start/stop.

| File order | Isolated elapsed | Shared elapsed | Observed saving |
| --- | ---: | ---: | ---: |
| Forward, isolated first | 118.202s | 71.687s | 46.515s / 39.35% |
| Reverse, shared first | 94.888s | 74.778s | 20.110s / 21.19% |

All profiles used PostgreSQL image
`sha256:54451ecb8ab38c24c3ec123f2fd501303a3a1856a5c66e98cecf2460d5e1e9d7`
and media image
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
The latter provides ffmpeg/ffprobe 8.0.1. All 2,986 code/config inputs retain
aggregate SHA-256
`ce9e5a241676b9856e4e4a3bc5251dad4a125b992ce39163d916bac915872ffd`
at opening and closing checks for every sample.

Container-start phase totals were 22.861s/2.571s forward and 13.842s/2.102s reverse
for isolated/shared. Four template-preparation totals were 7.596s/4.910s forward
and 4.930s/4.973s reverse. These inclusive spans are not additive components of
elapsed time; their variation also prevents attributing the entire saving solely
to removing four starts. Source hashing, prerequisite checks and report writes
are outside sample timing. Native output callbacks and owned release are inside.
Two pairs on one Windows/Docker Desktop host are descriptive, not statistical
confidence, hosted-CI evidence or a whole-gate speedup. Unchanged assertions
verify private expected state; no cross-profile SQL projection digest was added.
Both variants enable phase timing and the additional evidence reporter. These
observations apply to those instrumented profiles; ordinary command timing
without that instrumentation remains unmeasured.

Phase coverage is incomplete for recovery: its nine tests create fourteen
databases and call applyPendingMigrations directly, without schema_prepare or
scenario_work wrappers. The zero recorded spans there are unknown cost, not zero
work. All fourteen creates/drops and case outcomes remain compared. In the first
isolated profile that file took 28.083s; elapsed time alone cannot identify how
much was migration work.

The complete fast gate passes 10,355 tests: 5,383 server, 4,384 client and 588
script, zero failures/cancellations/skips, plus static policies, complete lint
and both builds in 134.429 seconds. The client build completes in 2.19 seconds.
The 225 existing Vue fixture warnings match the previous gate's count; no client
source changed. Production dependency audit reports zero known vulnerabilities.
The complete 2,986-input fingerprint still matches after fast validation.
Both repository skills and the installed standards skill structurally validate;
the installed skill is maintained as a focused reference update, not a new blind
skill trial or a general security/accessibility certification.

Nine frozen JavaScript files match staged bytes, 100 previously frozen source
files remain unchanged and 733 local links across ten changed Markdown documents
resolve. Four installed standards files match repository bytes. Staged whitespace
checks pass. Private native/report artifacts are retained in
`.tmp/postgres-cohort-comparison-1CSz9D/`; focused, fast, audit, source and comparison
summaries remain in `.tmp/postgres-cohort-2026-10-15/`.

## Recommendation and next item

Use the existing shared profile for this audited cohort during focused local
iteration. Keep the new four-profile benchmark explicit and preserve fresh
dedicated lifecycle/migration controls. Benefits: fewer server starts and matched
local evidence with all current assertions; costs: parent ownership/protocol work,
evidence maintenance and a four-run measurement. Default CI scheduling remains
unchanged; two local pairs do not justify broad rollout or extra concurrency.

Recommended stack: audited fixed cohort → isolated serial file processes → fresh
parent/scenario ownership → bounded native case/phase evidence → source and
registration/release verification → counterbalanced descriptive comparison →
separate default-promotion evidence.

Next: instrument actual recovery schema preparation and scenario work, then
evaluate its fourteen fresh databases against the existing migration-template
mechanism. Preserve fresh seeds, current SQL/lease/cancellation assertions,
independent pools and dedicated untemplated migration coverage. Attribute cost
before choosing template adoption; keep production and default scheduling scope
separate. Hosted Ubuntu canonical-media evidence remains a separate prerequisite
before media-default promotion.

The subsequent [recovery schema outcome](RECOVERY_SCHEMA_TEMPLATE_OUTCOME.md)
completes its timing/template evaluation follow-up. The 107-create, fourteen
unwrapped-recovery observations above remain historical pre-adoption evidence.

Opening and final GitHub MCP collection reads found zero open PRs. No random or
stale PR was available to implement or rebase. No PR comment, merge or other
external message occurred.

See [design](POSTGRES_COHORT_COMPARISON_DESIGN.md) and
[official research and pros/cons](POSTGRES_COHORT_COMPARISON_RESEARCH_2026_10.md).
