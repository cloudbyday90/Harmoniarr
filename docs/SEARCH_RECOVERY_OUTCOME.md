# Saved-search recovery outcome

Date: 2026-10-20. See the separate [design](SEARCH_RECOVERY_DESIGN.md),
[official research and alternatives](SEARCH_RECOVERY_RESEARCH_2026_10.md), and
[Docker outcome](LOCAL_DOCKER_SEARCH_RECOVERY_OUTCOME.md).

Shared release discovery now stops its current claim when a saved provider
search expires or is absent. One conditional database update persists the
schema-supported blocked state, a bounded failure and no next-search deadline.
Reconciliation retains the stop; no successful no-match attempt is consumed.
Missing Music presents Search needs help with the precise recovery instruction.
Existing match/download/library/setup states retain their precedence.

The existing Search again command owns new intent. It retains actor/recipient
resolution, current account and maintenance checks, wanted/discovery locks,
durable replay, required audit and coalescing. Committing a new generation clears
obsolete failure, pending continuation and claim evidence. An older claim cannot
stop that generation. Old search reservations remain; the new generation obtains
a different UUID and subsequent reads reuse it without another submission.

Background Jobs identifies these shared discovery results and offers a native
link to Missing Music. Its message directs the operator to the current release
decision; reading historical job evidence creates no new search authority.
The web standards skill's native-search reference now teaches this procedure,
including the separate external-request owner and evidence limits.

Executed validation on Node 24.22.0/npm 12.0.2:

- `validate:fast`: 10,669 tests (5,581 server, 4,391 client, 697 scripts), zero
  failures/cancellations/skips; static policy checks, complete lint and builds.
- One focused PostgreSQL/HTTP cohort: 13 tests, zero failures/skips, 36.0 seconds.
  It combines Search again, existing recovery projection, and durable search
  continuation. The new case covers both expiry and provider absence, same-key
  replay, current action projection, unchanged no-match budget, conditional stale
  stop refusal and retained old/new reservations. Four controlled provider starts
  represent two original searches and two explicitly renewed searches; replay
  and read continuation add none. These provider responses are controlled service
  fixtures, not live Soulseek traffic.
- Two rendered browser cases, zero failures/skips, 9.5 seconds: Background Jobs
  keyboard handoff with no mutation, expired-search keyboard activation, disabled
  pending control, polite feedback outside the busy snapshot, command-result
  focus, detail/list refresh and preservation of focus on failed background reads.
  The application shell/browser are real; the feature API projections are fixtures.
- Existing web standards skill passes structural validation. PR #48's complete
  MCP patch, head, package/lock and installed consumer inputs match the retained
  failed TypeScript 7.0.2 candidate and passing TypeScript 6.0.3 control. It remains
  open and unapplied; no PR was merged or rebased.

Development failures were retained and corrected: PostgreSQL refused invented
`failed` and fixture-only `completed` discovery states; browser pending checks
exposed an incorrectly placed fixture response gate. Final results above passed
with the existing resource limits and deadlines. No timeout was increased.
The final normalized source fingerprint is 3,140 files,
`cb07a7246327d03f0af36fc996adb45a567e17f37270eee1dd8e9db86321bf3a`.
Database/browser proofs ran before line-ending normalization; application and test
logic did not change afterward. The complete fast gate used the final bytes.

This is shared ordinary release-search recovery. Approved external-request and
scoped download-recovery intent have separate owners. No native transport/import
matrix was repeated for this state/UI change. Automated browser checks do not
prove screen-reader announcements or full WCAG conformance. No release or tag is
created.

Approved external-request expiry/absence recovery is now implemented in the
[separate outcome](EXTERNAL_SEARCH_RECOVERY_OUTCOME.md), including current
recipient/intent locks, atomic new-run/audit handling, durable replay and a native
stale Retry refusal. Confirmed empty external searches now have their own
[cooldown/budget outcome](EXTERNAL_EMPTY_SEARCH_OUTCOME.md). Next: make bounded
candidate-filtering reasons actionable without conflating them with empty searches.
