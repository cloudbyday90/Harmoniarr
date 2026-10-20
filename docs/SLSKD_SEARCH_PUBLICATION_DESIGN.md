# slskd search response publication design

October 20, 2026. A completed provider state can precede its response-body write.
The focused reproduction returns Completed/count 1 with empty bodies, then a
real response on a later observation. The old ingestion returns zero candidates;
an indefinitely unpublished body also incorrectly succeeds. Both controls fail
on the opening code. This is a deterministic service reproduction of the released
source ordering, not a measured production race frequency.

Extract polling into `slskd-search-response-service.js`. Existing nonempty
responses still return immediately. Empty results require a completed, finalized
snapshot with zero response/file/locked-file counts and a confirming response
read. slskd 0.26.1 persists `endedAt` with final bodies; its earlier completion
callback preserves the previous timestamp. Positive observed counts are sticky:
a later regressing snapshot cannot authorize a false zero result.
Provider Cancelled/Errored observations refuse with `slskd_search_failed`;
ordinary completed TimedOut searches can still produce a finalized empty result.

The normal observation budget remains 15 polls at one-second intervals, including
queued start. The first observed completion gets at most three additional polls
for publication, even if it arrives on the last normal poll. Repeated completion
or state regression never resets that allowance. Exhaustion raises sanitized
503 `slskd_search_responses_not_ready` before normalization, candidate transaction
or ingestion audit. An empty response without a state reader is unverified.
This is a bound on admitted work, not an exact wall-clock SLA: provider requests
retain their existing ten-second timeout and event-loop delay can add time.

Read errors propagate instead of being swallowed. An optional current-search
guard runs around awaited reads and delays. External request discovery supplies
its existing cancellation/maintenance/target guard; the existing locked
`beforePersistCandidates` guard remains the publication authority. This does not
abort a read already in flight or cancel the provider search remotely. No search
POST is retried by polling and no new queue, transaction system or migration is
introduced. Existing dispatch failure recording remains separate from successful
zero-candidate cooldown/exhaustion.

Use fast injected controls for ordering, exhausted work, finalized zero,
regressing counts, read failure and cancellation. Run the existing native
search-to-audio lane once against the rebuilt app to cover real provider reads,
candidate persistence, canonical acquisition, inspection and publication. It
qualifies the ordinary native path; it does not force the provider's internal
database race. Keep design, [research](SLSKD_SEARCH_PUBLICATION_RESEARCH_2026_10.md),
and executed outcome in separate documents.
