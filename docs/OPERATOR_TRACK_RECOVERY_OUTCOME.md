# Two-owner recovery outcome

October 12, 2026. Baseline main `6d40849`. The separate
[design](OPERATOR_TRACK_RECOVERY_DESIGN.md) records alternatives and selected
boundaries; [official research](OPERATOR_TRACK_RECOVERY_RESEARCH_2026_10.md)
records MCP-discovered primary sources and their applicable status/version.

## Implemented behavior

A failed second private copy leaves the first verified delivery as a bounded
candidate checkpoint, with both accepted owner plans and required event. Retry
independently rechecks the complete current participant set, catalog/consent,
private roots, media identity and destination hash. It retains the first file and
changes only the unresolved recipient; shared downloaded input is retained and
no provider dispatch is authorized by this failure.

Six small ESM progress/recovery/lifecycle modules own policy, SQL and service
responsibilities. Existing apply workers, operation runs, lease acquisitions,
canonical source/projection locks and transactions remain the command owners.
Checkpoint internals are excluded from public control-plane output. Current
authority is checked before file mutation, after checkpoint events and after
the required final candidate event.

Final publication commits both byte-backed receipts, candidate applied state,
two source retirements and required events together. A refused source event rolls
all of that back; both verified files can later publish without another copy.
Wanted reconciliation reads current private-root availability, then mutates
matching source state in its own guarded transaction. Replacing one delivery
reopens only that owner's existing source/Wanted requirement. Its exact reopened
marker prevents an old applied receipt from suppressing reacquisition; newer
available evidence wins over an older missing copy. Repeated reconciliation
does not duplicate the transition event.

## Executed evidence

- Focused literal-path tests: 164/164 across thirteen files, plus the owning
  candidate service's 32/32. These precede the final small unsupported-envelope
  guard/empty-lifecycle optimization; the frozen broader gate below includes both.
- Frozen `npm run validate:fast`: 9,995 passing cases (5,057 server, 4,384 client,
  554 scripts), no failures/cancellations/skips, static checks and both builds.
  Command elapsed 189.933s; this is a local observation, not a speed benchmark.
- Initial new native controls: 2/2 with real PostgreSQL, actual apply workers,
  tagged media and owned filesystem fixtures. Besides the partial retry and
  owner-specific reopening, controls refuse changed peer plans, redirected
  private directories, disabled/changed participants, changed catalog/bytes and
  malformed checkpoints. A lease-expiring checkpoint-event trigger rolls back
  the checkpoint/event and leaves the unrecorded physical copy blocked for review.
- Native checks keep process isolation, serial execution, existing 90-second
  scenario bounds, two-client pools and ten-second checkout limits. No provider
  contact, retry, skip or deadline increase masks a failure.
- Final frozen affected serial cohort: 88/88 across twelve literal files, zero
  failures/cancellations/skips. It covers recovery, catalog, consent, publication
  authority, Wanted/release reconciliation, metadata/reconciliation/apply worker
  lifetimes, import/media operations, Music Queue recovery transactions and
  Missing Music fallback. The two new controls are included, not added twice.
  TAP elapsed 256.904s; command elapsed 257.008s. This is the affected cohort,
  not a new complete integration execution or a matched speed comparison.

All 21 changed JavaScript files remain identical to the frozen candidate in both
the working tree and Git index. The native media image is the existing
`harmoniarr-quality-fallback:local` at
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
with ffprobe 8.0.1 and network-disabled media execution; the native PostgreSQL
observations report 18.3. No migration/schema, dependency or UI change is included.

Ignored diagnostics are retained under `.tmp/operator-track-recovery-2026-10-12/`:
the pre-fix collision failure, the first native fixture's invalid claim adapter,
and the native peer-root rejection that exposed missing unresolved-plan binding.
The adapter was corrected to the existing claimed snapshot, and both plans are
now persisted/rechecked. These failed runs are separate from final passing proof.
Historical connection-reset causality remains unresolved.

## Scope and next recommendation

Supported scope remains two distinct disc-one tracks, one per owner. Unrecorded
filesystem/SQL crash gaps, stale consent/plans, larger unions and uncertain old
intents remain review. SQL cannot atomically commit file copies or fence unrelated
privileged filesystem writers. Media tags are not acoustic identification.
Reopening requires the current matching saved scope and owned retirement marker;
changed scope or withdrawn intent cannot revive an obsolete candidate.

Keep the implemented stack: current authority → verified private copy → atomic
checkpoint/event → independently verified resume → final receipts/source events
→ current availability reconciliation. This avoids a new schema/job system and
provider replay; its cost is JSON receipt lookup and repeated filesystem checks.
Next, design an indexed owner receipt ledger with scan-owned invalidation and an
explicit backfill contract. Measure lookup cost first, preserve historical versus
current evidence, and prove rollback/concurrency before replacing these reads.
Scope-changing source intake is a separate later lifecycle contract.

The existing standards/scoped/testing skills now document this method: five
structural validators pass and seven installed standards/scoped files match
source SHA-256 hashes. `npm audit --json` reports zero vulnerabilities; that
registry result is not a complete security audit. This is reference maintenance
without a new blind evaluation. The [PR applicability outcome](OPEN_PR_APPLICABILITY_TRACK_RECOVERY_2026_10_OUTCOME.md)
finds no new unreplayed revision. Work stays on main; no release or PR merge.
