# Lease acquisition fencing outcome

Implemented on main, October 9, 2026. The separate
[design](LEASE_ACQUISITION_DESIGN.md) records alternatives, pros/cons, final stack
and rollout limits. [Official research](LEASE_ACQUISITION_RESEARCH_2026_10.md)
records fresh MCP discovery and source authority. No branch, release, tag,
provider upgrade, PR merge or deployment is part of this slice.

## Implementation and ownership

The additive migration, generated snapshot and schema anchor add a private
acquisition UUID while preserving the stable lease row ID. Narrow ESM ownership
policy/key-lock modules and the generic store require captured tokens; advisory
key then row locks protect absence and existing ownership. Fresh clock checks
follow lock waits. Live same-owner acquisition is refused; renewal cannot revive
expired work, and exact release can retire only its own current acquisition.

The operation-run bridge delegates to narrow owned lifecycle service/store
modules, using current run/token under locks and the same transaction for retry
budgets. Stranded recovery uses one transactional observed-run/lease command.
Backup restore retains its explicit unleased contract with operation-type checks.
Fourteen worker adapters retain the acquisition, guard failed/lost ownership and
thread the captured token through heartbeat, lifecycle and final release.

New preparation/closure frames capture the token and direct closure SQL rotates
and compares it. Historical immutable three-field frames remain readable proof;
they receive no current authority from migration values. Public lease diagnostics
use an allowlist; the private token is not a public bearer credential.

## Executed evidence

Final `npm run validate` exits successfully: 9,327 tests pass, zero failures,
cancelled, skipped or todo tests, all required lint/policy checks and both builds.

| Complete suite | Passed |
| --- | ---: |
| Server | 4,152 |
| Client | 4,377 |
| Scripts | 513 |
| PostgreSQL integration | 285 |

The complete command uses `HARMONIARR_INTEGRATION_MEDIA_IMAGE=harmoniarr-quality-fallback:local`.
The inspected local media fixture is
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
with ffprobe 8.0.1. This is local test tooling, not a published application image.
No Vue control or keyboard interaction changed, and no new browser or
assistive-technology test was run in this slice.

`npm run update:schema-snapshot` passes with 105 migrations.
`npm run validate:schema-bootstrap` passes 105/105, and
`npm run check:schema-anchors` passes 116 anchors in source and snapshot databases.
Focused ownership/store/preparation compatibility checks pass 49, zero skips;
non-import worker/privacy checks pass 123 and shared bridge checks pass 33.
Import-worker/heartbeat checks pass 50. These groups overlap other focused
and complete validation. Their injected store/callback tests do not establish
actual SQL locks, native provider effects or filesystem atomicity.

Fresh `npm run validate:security` passes policy checks and reports zero npm
vulnerabilities. First/corrected complete logs and raw MCP artifacts are
retained under ignored `.tmp/lease-acquisition-2026-10/`.

The first actual PostgreSQL acquisition suite passes eight scenarios, zero skips:
real migration backfill with stable IDs/old frames; same-owner live refusal and
fresh tokens; old lifecycle/release/heartbeat and late worker completion; expiry
after an actual key-lock wait; stranded token and absent-row races; current retry
budget and the explicit backup exception's refusal of a foreign leased row.
These establish local database/callback behavior, not external exactly-once.
The first affected PostgreSQL block passes 87 of 89, zero skips. Only two older
import-operation fixtures fail: each captured a lease, then redundantly acquired
the same live key again. The source correctly raises operation_run_lease_unavailable.
Those setups now use their original captured token and retain history/phase
assertions. Actual list/detail token-privacy checks were added. Isolated affected
cases pass two of two, then the complete original serial command passes 89 of 89,
zero failures/skips. It includes the new eight and existing closure, refusal,
batch/receipt, adoption, recovery/discovery, wanted-reader, retention and
import-operation regressions. Focused groups overlap this and the complete run.

## Original failures and corrections

- The first store/closure command passed 10 of 17: old fixtures omitted the
  newly captured token or transaction client. Newly acquired fixtures now return
  issued UUIDs; historical saved frames stay three fields.
- New policy/compatibility checks passed eight of eleven and caught real current-
  authority gaps: two tokenless tuples could pass the preparation gate, and
  explicit null clock was coerced into a number. Both current tuples now need
  valid tokens; clocks are finite numeric values. Corrected eleven pass, while
  old immutable certificates remain readable.
- The subsequent store/closure command passed 18 of 25. Fixtures expected two
  SQL calls before the shared advisory key lock was introduced. The corrected
  harness checks advisory, row lock and final write using the same client;
  all 25 pass. No real database claim is derived from that harness.
- Initial expanded non-import checks passed 80 of 81, then 84 of 85: new fixtures
  incorrectly assumed a single organize start write and relied on mock call-count
  timing. Explicit initial/progress sequencing preserves original side-effect
  assertions; final 85 pass. No runtime eligibility guard was relaxed.
- The original three bridge test files passed ten of twenty under a test-process
  network blocker. Old key-only/void lifecycle and separate recovery APIs no
  longer express the captured-token transaction contract. Explicit clients and
  acquisition receipts preserve their retry, cancel and pause assertions; final
  ordinary invocation passes 33, including stale/release-failure/rollback controls.
- Final copyright preflight caught a missing header in the generated migration.
  Adding the required header changes its checksum, so the prescribed snapshot
  workflow was rerun. Corrected copyright passes 1,426 files; regenerated schema
  bootstrap passes 105/105 and anchors pass 116. The first log is retained.
- The first complete validation command passed 4,149 of 4,151 server tests,
  with two old ledger-retention fixtures failing before later suites/builds.
  They omitted ownership and expected only one SQL call. The focused original
  file reproduces five of seven; valid same-client acquisitions now prove one
  parent mutation and no inline pruning for all three terminal actions, including
  the formerly vacuous Failed control. A new stale-token control proves zero
  mutation/pruning. The expanded file passes eight; original pruning policies
  remain unchanged. First complete and focused logs are retained separately.
- The second complete run passes all 4,152 server, 4,377 client and 513 script
  tests, then 279 of 285 integration tests. Five cases still invoke removed
  separate recovery helpers; one test-only preparation helper completes three
  runs without ownership, leaving an exact ledger count at three instead of six.
  The original three-file command reproduces two passes and six failures. These
  callers now use observed-state atomic recovery and genuinely acquired
  preparation start/completion/release; the repeated command passes eight of
  eight. Cancellation/double-recovery, exact ledger count six, and both zero-
  provider assertions remain unchanged. Original and corrected logs are retained.

## PR applicability and practical standards skill

Fresh GitHub MCP collection/head/base/file checks found no eligible unreplayed
patch; all three observed open patches match their existing local replays. No
random draw, duplicate replay, downgrade or merge applies. Separate
[PR design](OPEN_PR_APPLICABILITY_LEASE_ACQUISITION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_LEASE_ACQUISITION_2026_10_OUTCOME.md) retain actual
discovered URLs, timestamps, immutable comparisons and raw evidence hashes.

The [practical standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
references now trace captured tokens across workers, lifecycle and recovery,
private diagnostics, refreshed time and compatible historical proof. Source and
installed structural checks pass; all four files match by SHA-256 after sync,
and entrypoint links resolve. These establish structure and byte identity, not
a new blind behavioral trial or standards conformance. The backend skill's old
snapshot path was corrected to `src/server/schema-snapshot.sql`; its source
structural check also passes.

## Limits and next recommendation

Captured tokens fence updated local producers. Stop old key-only workers before
deploying the new schema/code. Unreleased historical leases keep their deadline;
an unclean shutdown can delay recovery until expiry. Ongoing external/provider/filesystem effects
cannot be rolled back by lease loss.

Next: the library-organize worker's final active-acquisition gate before
applyExclusiveFileMutationPlan. Its current flow moves the file and updates the
canonical database path before a later progress lifecycle write detects lost
ownership. Thread the captured token to the actual mutation owner; hold an old
worker after preview, acquire a replacement, then release the old body. It must
perform no new move/path update/notification while the replacement can complete.
This is a source-backed follow-up for preventing new effects, not a promise to
undo effects already in flight or provide filesystem/database exactly-once.
