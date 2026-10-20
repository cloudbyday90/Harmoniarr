# Approved external-request search recovery outcome

Date: 2026-10-20. See the separate [design](EXTERNAL_SEARCH_RECOVERY_DESIGN.md),
[official research and alternatives](EXTERNAL_SEARCH_RECOVERY_RESEARCH_2026_10.md)
and [local Docker outcome](LOCAL_DOCKER_EXTERNAL_SEARCH_RECOVERY_OUTCOME.md).

Approved external releases now support explicit Search again when their current
saved provider search expired or became unavailable. The discovery worker saves
only these allowlisted failure codes with fixed public recovery messages.
Administrator review projects the action only for a failed current run and its
currently eligible recipient. Existing approval still replays its original
intent, and ordinary unsuperseded job Retry continues its saved search.

The narrow ESM recovery service and store resolve the approved intent and current
recipient on the server. A new command supplies the expected failed run, requires
a fresh administrator session, CSRF, rate limiting and a durable command key.
Maintenance, account eligibility, request, intent and current job locks guard the
write. The new run, intent pointer, old-run supersession and required audit commit
together. An audit failure rolls everything back. Separate keys targeting the
same predecessor coalesce; the command cache returns exact same-key outcomes.
The predecessor reference survives worker terminal summaries, so a later replay
does not queue additional work after the replacement has already completed.

Recovery updates the old run's supersession marker, and the actual ordinary Retry
UPDATE refuses that marker. The native test observes a Retry waiting on the old
row before recovery commits, then verifies refusal. A read lock by itself would
not provide this property. Another native test holds a recipient-disable write,
observes recovery waiting on eligibility, commits the disable and verifies no new
run or recovery audit. All old provider reservations remain. A new operation run
changes the existing search context and receives a different provider UUID.

The focused Vue component/composable keeps pending feedback outside busy state,
retains the exact key/expected run after an uncertain response, and can resolve
that saved command even when refreshed review already shows the replacement.
Queued success survives optional refresh failure. Command-result focus moves
only while the interaction still owns it; moving to another control is preserved.
Refresh retains its existing focusable, guarded aria-disabled behavior. Background
Jobs provides a read-only handoff to the owning request review. Discovery still
publishes target-owned pending candidates for review; it does not start downloads.

Executed validation on Node 24.22.0/npm 12.0.2:

- Complete `validate:fast`: 10,676 tests (5,583 server, 4,396 client, 697 scripts),
  zero failures/cancellations/skips, plus static policy checks, full lint and both
  production builds.
- One stable PostgreSQL/HTTP cohort: 47 tests, zero failures/skips, 94.8 seconds.
  Six new recovery cases cover expiry, absence, concurrent distinct-key commands,
  exact same-key replay and payload mismatch, current authority/refusal, required
  audit rollback, a stale Retry lock wait and recipient-disable lock wait. The
  cohort also includes six existing discovery lifetime cases, 13 approval/review
  cases and 22 collection cases.
- The two recovery/provider cases use real PostgreSQL, authenticated application
  HTTP, the actual slskd client/service, controlled native loopback HTTP and actual
  candidate ingestion. Each submits one original provider search and one explicit
  replacement; replay adds none. Both old/new reservations remain. The replacement
  candidate retains the approved intent, request and recipient and stays pending
  review. This is not a live Soulseek daemon/public-network search or transfer test.
- Eight browser cases passed, zero failures/skips, 38.6 seconds: two new recovery
  cases plus existing edition and collection review. They cover job navigation,
  permission refresh, keyboard activation, pending/feedback, uncertain retry,
  retained key/body/CSRF, optional refresh failure, focus ownership, and existing
  collection Refresh behavior. The real application shell renders controlled
  feature API projections. The 390-pixel mobile recovery screenshot was inspected;
  no overflow was observed and the new mobile button meets the 44-pixel project
  target. Screen-reader announcements and full WCAG conformance were not tested.
- The web standards skill was extended with approved-intent recovery, actual
  row-update fencing and account lock-wait evidence; structural validation passes.

Retained development failures were corrected: an incomplete unit response fixture,
an immediate browser assertion before refreshed permissions rendered, a focus
regression from natively disabling Refresh, and a focus-outline assertion after
pointer activation instead of keyboard activation. The stable gates above pass
with existing deadlines and resource limits; no timeout was increased.

The normalized source fingerprint is 3,148 files,
`ba07fd9be0a8308c92ec62432eeb3d93989b96ba0e6d756a4f86714481bb5c1a`.
Database/browser proofs preceded line-ending normalization; their application and
test logic remained unchanged. The complete fast gate used the final bytes.
Private logs, source/patch checks and the mobile screenshot are retained under
`.tmp/external-search-recovery-2026-10-20/`.

Random open PR #48 remains unapplied. Its MCP patch and head, package/lock and
installed consumer inputs are identical to the retained failing TypeScript 7.0.2
candidate and passing TypeScript 6.0.3 Vue control. The new random draw and current
research are recorded in the research document. No PR was merged, closed or
rebased; no new branch, version, tag or release was created.

Confirmed zero-result recovery is now implemented in the
[separate outcome](EXTERNAL_EMPTY_SEARCH_OUTCOME.md), with durable cooldown/budget,
qualified publication evidence and policy-aware replay. Next: expose bounded
filtering reasons when responses produce no usable candidates, so the operator
can correct metadata/quality decisions before requesting more provider work.
