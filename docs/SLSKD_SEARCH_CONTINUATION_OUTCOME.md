# Durable search continuation outcome

October 20, 2026. Implemented the [design](SLSKD_SEARCH_CONTINUATION_DESIGN.md)
and [official recommendation stack](SLSKD_SEARCH_CONTINUATION_RESEARCH_2026_10.md)
on main. Shared discovery and approved external release discovery now reserve
owner/context/configuration-bound UUIDs before POST. Only a reservation creator
can submit; later service instances read the same UUID. Returned identity/query
must match. Missing records, expiry and changed configuration refuse another
submission. Credentials and raw provider responses are absent from the new table.

The additive migration creates cascading owner FKs, an exactly-one-owner check,
fingerprint/expiry checks and owner/intent unique indexes. Snapshot generation
used the repository workflow against PostgreSQL; critical anchors cover the
binding, expiry, acceptance observation, ownership, FKs and unique indexes.
Pending continuation commits with reservation before network work. Reconciliation
honors its current claim/attempt and successful discovery clears it. The prior
successful search identifies the next scheduled cycle. Existing queue/workers,
current target/maintenance/cancellation and locked persistence checks remain.
Configuration is rechecked around HTTP and before candidate persistence.

Review also reproduced cancellation/pause being caught as ordinary batch failure.
The dispatcher now propagates cancellation, pause and lost lease to the owning
worker, including during track fallback, instead of continuing or completing the
batch. The new interruption controls failed before this correction and pass now.

Fast validation passed 10,664 tests (5,577 server, 4,390 client, 697 scripts),
static checks, lint and builds, without skips or cancellations. Eighteen added
fast cases cover restart reuse, uncertain Error/null, absent records, expiry,
configuration and identity drift, owner/scope/generation separation, canonical
fingerprints, replaced external runs, reconciliation cooldown and interruptions.
The first fast attempt exposed two worker fixtures assuming the old callback
arguments; they were updated to exercise the forwarded guard.

The final PostgreSQL/HTTP cohort passed all 20 cases in 42.0 seconds. It includes
an overlapping held POST/read continuation through recreated services, committed
UUID/pending marker before HTTP, one submission, uncertain acceptance, SQL
rollback, replaced claims, owner deletion/cascade, approved target isolation,
real HTTP ingestion, current-target refusal and actual worker completion.
An earlier cohort passed; a later attempt during image building passed 19/20 and
hit a fixture-setup connection timeout. The final sequential retry used unchanged
timeouts/pool caps. That success does not diagnose the earlier failure's cause.

The final native case passed in 84.2 seconds (85.7 with runner overhead). Actual
slskd 0.26.1 accepted two supplied search UUIDs and four compressed peer responses.
Recreated service instances resumed both saved IDs; actual provider evidence
still contains exactly two search POSTs. PostgreSQL observed two accepted intents
before owner retirement. Real ingestion produced four candidates; canonical
selection/start, transfer, valid media inspection/apply/required audit/catalogue
and equal-size corrupt-file refusal all passed. Fixture cleanup was verified.
See the separate [Docker outcome](LOCAL_DOCKER_SEARCH_CONTINUATION_OUTCOME.md).

Final non-Markdown source: 3,136 files, SHA-256
`88941674ba37fda174330b18728afc8aace1572e33e049c6adeefbc2b6cefb31`.
The fast gate preceded a cleanup-only refinement to the new SQL fixture: on a
second-attempt failure it now drains the first held attempt before database
teardown. Production/unit files are byte-identical to the passing fast gate;
focused ESLint and the complete 20-case cohort passed after that refinement.
The native case and packaged-runtime inventory match final source. Focused
timings are observations, not a whole-suite speedup. Failed attempts are retained
privately under .tmp/search-continuation-2026-10-20/.

The standards/testing skills now teach reservation authority, uncertain POST,
claim/cooldown reachability, separate SQL/HTTP/native proof and honest limits.
Both skill entrypoints passed structural validation. [PR 48](OPEN_PR_48_SEARCH_CONTINUATION_EVALUATION.md)
was randomly selected, refreshed and remains unapplied after full package/lock/
installed-consumer applicability and retained-failure checks.

This proves at most one application submission per reserved intent, not exactly
once distributed execution. A crash before sending can leave a missing provider
record; a new explicit intent is required for recovery. Per-track best-effort
exhaustion retains its existing terminal policy and has no separate continuation
scheduler. Native owned search does not establish public-network discovery,
remote-source authenticity, full decoding or general standards conformance.

Shared release recovery is now implemented in the separate
[recovery outcome](SEARCH_RECOVERY_OUTCOME.md), including bounded Missing Music
state, a Background Jobs handoff, explicit Search again intent, replay and browser
status/focus evidence. The separate [external recovery outcome](EXTERNAL_SEARCH_RECOVERY_OUTCOME.md)
now qualifies the approved intent/run command too. Next: explicit fresh searches
after completed zero-result external discovery. No release,
tag, new application branch or PR merge is created here.
