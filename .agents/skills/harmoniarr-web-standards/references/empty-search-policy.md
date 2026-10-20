# Confirmed empty-search recovery

Read [design](../../../../docs/EXTERNAL_EMPTY_SEARCH_DESIGN.md) and
[consulted sources/tradeoffs](../../../../docs/EXTERNAL_EMPTY_SEARCH_RESEARCH_2026_10.md)
when changing external-search cooldown, attempts, ingestion evidence or recovery.

Trace the evidence before granting another expensive operation. Zero accepted
candidates can mean filtering; an empty provider body can mean publication delay.
The slskd response adapter owns final publication/strict zero counts. Carry its
qualified outcome through ingestion's guarded transaction into the worker and
review projection. Generic errors, stale terminal summaries and cancellation
must not inherit a previous successful empty result.

Keep command replay distinct from a new search. Resolve the accepted predecessor
before checking the new-search cooldown/budget. Preserve an uncertain browser
key/body even if refreshed review now hides Search again. Current session, target
eligibility and ownership still apply to every command.

Resource policy belongs on the durable approved intent, not a count of retained
job history or a transient provider reservation. Use database observation time,
record once per current run, and consume budget atomically with run replacement,
supersession and required audit. Reservation expiry, worker retry and restart do
not reset the budget. Verify audit failure rolls back the counter too.

Six hours and two extra commands are Harmoniarr policy, not OWASP/W3C requirements
or shared-discovery configuration. Revisit the SQL constraint/store and pure
policy together if that convention changes. Do not add a reset bypass without a
separately designed current-authority and audit contract.

Project a server deadline/reason/remaining count; render semantic time and bounded
copy beside the control. Refresh may reveal eligibility without moving focus.
Do not automatically submit at the deadline or use the browser clock to authorize.
Keep command feedback outside busy state. DOM/browser checks establish rendered
behavior; they do not establish screen-reader announcements or full conformance.

Choose cheap boundary controls for time arithmetic and filtered/unpublished
refusals, one real PostgreSQL/HTTP sequence for cooldown, budget, coalescing and
replay, plus browser policy transitions. The owning cases are
`external-request-search-recovery.test.js` in integration/browser and
`external-empty-search-policy.test.js` in server tests. Avoid repeating unrelated
native media/transfer matrices when their owners did not change.
