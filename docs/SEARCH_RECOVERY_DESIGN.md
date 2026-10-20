# Saved-search recovery design

Date: 2026-10-20. Builds on [durable continuation](SLSKD_SEARCH_CONTINUATION_DESIGN.md).

An expired or absent provider search cannot be resumed safely. Shared release
discovery currently records this as a diagnostic failure while retaining an
automatic cooldown, so Missing Music promises automatic progress indefinitely.

Stop only the current shared discovery claim when the continuation reports
`slskd_search_continuation_expired` or `slskd_search_continuation_unavailable`.
Atomically save a bounded failure, clear pending continuation, and remove its
deadline. Reconciliation must preserve this stop. Do not advance the successful
no-match budget, delete old provider reservations, or resubmit their POST.

The database persists `blocked`; the acquisition projection presents `failed`
(Search needs help). Do not invent a database state from a public status name.

Project this as an actionable failed search, retaining higher-priority download,
library, setup and match states. Reuse Missing Music's guarded Search again
command: current actor/target eligibility, maintenance, owned wanted/discovery
locks, durable replay and audit remain authoritative. Clear obsolete failure and
pending evidence when committing the new rediscovery generation. A late failure
from an older claim must not replace that new intent.

Background Jobs links affected shared discovery results to Missing Music's
action list and explains that a new release search requires Search again.
Historical job evidence does not authorize a mutation or identify current release
eligibility. The link is a read; only the existing authenticated command admits
new work. Existing command feedback/focus behavior remains in use.

No schema, dependency, release or branch change is needed. Approved external
request discovery has a separate intent/run owner; its explicit new-search
command is the next slice, rather than changing generic job retry semantics.

Validation: fast policy/projection/reconciliation controls; real PostgreSQL and
authenticated HTTP proof of stop, replay, new UUID and stale-claim refusal;
rendered keyboard recovery and Background Jobs navigation; final fast gate and
preserved no-cache local Docker walkthrough. Results belong in
[the outcome](SEARCH_RECOVERY_OUTCOME.md).
