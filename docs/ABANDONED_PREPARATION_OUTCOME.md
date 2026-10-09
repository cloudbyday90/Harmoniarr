# Guarded abandoned preparation closure outcome

Implemented on main, October 9, 2026. The separate
[design](ABANDONED_PREPARATION_DESIGN.md) records alternatives, pros/cons and
final stack; [research](ABANDONED_PREPARATION_RESEARCH_2026_10.md) records fresh
official MCP discovery and distinguishes source authority from inference.
No release, branch, tag, provider upgrade or PR merge is part of this slice.

## Implementation and ownership

Narrow ESM closure policy/service/store modules inspect one exact future
preparing epoch on idle manual single-candidate download work. Reserved recovery
and external-request jobs retain their existing owners. The caller's entire
epoch is compared with the locked run/item/source/manifest and its own staged
receipt-free attempt when present. Running, claimed, live/unverifiable lease,
historical, malformed, crossed and provider-evidenced work is refused.

The closure store refreshes clock_timestamp after locks and uses a distinct
short lease with no same-owner live takeover. Its acquisition time is truncated
to milliseconds to match the canonical ISO lease token used by exact release
CAS. The original epoch's lease and history remain intact; new closure ownership
and observed cancellation are separate private provenance.

The item refusal, reciprocal run summary fence, cancelled parent, required
closure audit and released fresh lease share one transaction. The owner performs
no provider I/O, restoration or dispatch. Ordinary writers and retry/claim/start
admission honor marker presence. Existing administrator origin restoration
still supplies authorization and complete positive older-batch proof.

## Executed evidence

`npm run validate` exits successfully: 9,201 tests pass, zero failures,
cancelled, skipped or todo tests, all required lint/policy checks and both builds.

| Complete suite | Passed |
| --- | ---: |
| Server | 4,034 |
| Client | 4,377 |
| Scripts | 513 |
| PostgreSQL integration | 277 |

The complete command uses `HARMONIARR_INTEGRATION_MEDIA_IMAGE=harmoniarr-quality-fallback:local`.
Its inspected local fixture is
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
with ffprobe 8.0.1. This is local test tooling, not a published application image.

Final focused serial PostgreSQL validation passes 65
scenarios, zero failures/skips: seven new closure cases and the 58 affected
existing refusal, origin, receipt, batch, recovery, adoption, wanted-reader and
retention regressions. The original new-case command's failed assertion was
reproduced and corrected in isolation (one pass), then repeated in this complete
65-case command. Actual native delayed beforeSend sends zero POSTs after closure;
required-audit and mid-audit lease-expiry failures roll back the item, parent,
lease takeover/release and audit together.

Focused checks pass 39 policy/service tests, 101 backend owner/consumer tests and 148
history/privacy/client tests, zero failures/skips. These groups overlap each
other and the complete run. Scoped lint and the client build pass. The root's
24 adjacent checks also pass. New module-wiring checks invoke the supplied
closure owner before confirmation and stop that item's later work after closure.

The policy/service command is
`node --test test/server/import-execution-preparation-closure-policy.test.js test/server/import-execution-preparation-closure-service.test.js test/server/import-execution-pre-provider-policy.test.js`.
Its service transaction/store doubles establish that contract; they do not prove
SQL locks or native provider behavior. History/privacy/client evidence uses
`node --test test/server/operation-history-service.test.js test/server/control-plane-redaction-service.test.js test/server/import-candidate-execution-public-projection.test.js test/client/operation-run-link-targets.test.js test/client/operation-run-presentation.test.js`.
No new Vue control or keyboard interaction changed, and no browser or assistive-
technology test was run in this slice.

Fresh `npm run validate:security` passes image/topology policy and all-severity
npm audit with zero reported vulnerabilities. Copyright checks cover 1,420
source files. Whitespace and local links in all staged Markdown files pass.
This slice's ignored logs and raw MCP evidence are under
`.tmp/abandoned-preparation-2026-10/`.

The first injected service command passed 11 of 12. Its null-marker control
correctly refused closure and retained the incoming marker, but the test expected
all observed markers to be absent. The corrected test compares the whole locked
frame, preserving that marker and proving no closure writes occurred; the
original first log remains. No runtime assertion or eligibility guard was relaxed.

The first actual PostgreSQL command passed six of seven, zero skips. Its only
failure expected the history-only preparationClosed flag on the separate execution
DTO. That DTO has no Retry control and intentionally exposes cancelled status
while omitting private records. The corrected assertion checks that status and
privacy; the existing history consumer tests own the safe Retry flag. Native
delayed callback, both crossing orders, required-audit/expiry rollback, lease and
claim refusal, stale writes and retention controls passed in the original command.
The original log is retained; final repeated-command results are recorded above.

## PR applicability and practical standards skill

Fresh GitHub MCP collection pages, immutable heads/bases and complete scopes
found no eligible unreplayed PR. The three open patches are already implemented
locally. No random draw, duplicate replay or merge applies. Separate
[PR design](OPEN_PR_APPLICABILITY_ABANDONED_PREPARATION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_ABANDONED_PREPARATION_2026_10_OUTCOME.md) retain
discovered URLs, timestamps, exact comparisons and raw evidence hashes.

The [practical standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
references now trace the distinct system owner, refreshed expiry clock, reciprocal
fences and cancellation-versus-provider outcome. Source and installed structural
validation pass, all four maintained files match by SHA-256 after synchronization,
and entry-point links resolve. These establish structure and byte identity;
no new blind behavioral trial or standards conformance is claimed.

## Limits and next recommendation

This protocol does not certify historical absence or post-boundary provider
uncertainty. Idle closure is restricted to supported manual single-candidate
work; running jobs wait for existing stranded recovery. Closure of reserved
recovery/external work requires its own atomic reservation/authority retirement.
Controlled HTTP and DTO tests do not establish live Soulseek exactly-once,
assistive-technology speech or whole-platform standards conformance.

Next: exact lease-acquisition token fences for worker renewal/release and stale
terminal callbacks. The generic [lease store](../src/server/job-lease-store.js)
currently updates by key; the [execution worker](../src/server/import-candidates/import-candidate-execution-worker.js)
passes only run identity to renewal/release. Stranded recovery also releases an
observed expired key without its captured acquisition token. Propagate the token
through those bridges and the heartbeat. Hold an old heartbeat/finalizer
across a replacement acquisition and prove it cannot change the new lease or
run status. This is a source-backed follow-up, not a claimed production exploit.
The closure transaction itself acquires and releases its fence atomically under
the row lock, with actual rollback and delayed-callback controls described above.
