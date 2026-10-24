# Search again after quality review: outcome

Implemented October 24, 2026 on main. See the [design](QUALITY_REVIEW_SEARCH_DESIGN.md)
and [official research, options and recommendation stack](QUALITY_REVIEW_SEARCH_RESEARCH.md).

## Delivered behavior

Missing Music offers the existing **Search again** command after a current measured
lossy-audio or suspicious-lossless refusal when the whole current search has no
eligible pending/held alternative. A bounded keyset scan checks beyond both the
twelve-choice public shortlist and the first fifty-row page. An eligible hidden
alternative correctly prevents an exhaustion restart.

Replacement selection and restart share a small ESM quality-review scope owner.
The restart uses the existing discovery intent, dispatcher, idempotency, Activity
and required audit. Canonical locks protect current actor privileges, recipients,
wanted/discovery links, active work and failed evidence. Reset intent, target marker
and audit commit together; shared recipients coalesce one root restart while
retaining their own current-cycle audit and target marker.

The durable requirement records original recipient identity and quality floor,
without a fallback-consent token. Discovery merges that floor with stricter current
policy before constructing the query and supplying ingestion quality context.
Ordinary later retries retain it. Explicit quality fallback retains its separate
authorization and consent owner. Changed owners/participants, fulfilled or ignored
recipients, and malformed requirements refuse before provider submission.
Reconciliation preserves that refusal; old claims cannot stop replacement work.

The failed candidate, verification evidence and downloaded bytes remain intact.
Accepted intent refreshes to Search queued, removes repeat command availability
and uses the existing accessible feedback and Current status focus behavior.
Acquisition follows saved automation policy; a queued search is not a completed
discovery, transfer or library add. No second application, dependency, migration,
branch, version bump, tag or release was introduced.

## Executed evidence

- Focused dispatch/decision/command/presentation cohort: 75 passed. Final
  store/reconciliation/requirement/acquisition/module cohort: 62 passed.
- Full fast gate: **11,075 passed** (5,902 server, 4,473 client, 700 script),
  zero failures, cancellations or skips. Lint, copyright/ESM/schema/Compose policies
  and both builds passed.
- Seven final real PostgreSQL/HTTP scenarios passed: recipient/CSRF authorization,
  original floor through actual claim/query/ingestion arguments, replay and queued
  refresh, beyond-shortlist/page exhaustion, required-audit rollback, shared intent
  coalescing, current drift, actual actor/recipient lock waits, post-queue refusal
  and stale terminal-write protection. Existing search/selection cohorts passed
  ten additional regression scenarios.
- Four real-app browser cases passed: new keyboard Search again, refreshed feedback
  and focus, reload, replacement selection and both existing review/recheck cases.
- Standards and testing AI skills passed the skill-creator validator and now route
  to a practical full-search/durable-floor reference.
- Three files had incidental line-ending churn removed after the fast gate. A
  hash comparison proves line-ending-only equivalence; the 62 focused checks passed
  again on the restored bytes before final packaging.

Earlier fixture failures remain in private logs: uppercase FLAC query expectation,
capturing the last non-null claim, updated review guidance and the added SQL
requirement argument in existing mocks. They were corrected and the affected
cohorts rerun; no failed case was disabled or weakened.

The SQL/browser scenarios use controlled search candidates and an injected media
gate. Query/ingestion argument proof is not public provider discovery or measured
audio. Packaged media and preserved installation evidence are recorded separately
in the [Docker outcome](LOCAL_DOCKER_QUALITY_REVIEW_SEARCH_OUTCOME.md). Real screen
reader and physical-device acceptance remain deferred manual work.

GitHub MCP found zero open PRs at initial selection and final recheck. No applicable random PR or
stale-PR rebase was available; no PR was merged.

## Recommendation and next item

Keep the native Vue command, shared ESM scope, PostgreSQL intent/audit transaction,
durable quality requirement and existing dispatcher/ingestion stack. It preserves
the existing acquisition authority with a small targeted extension. The cost is
additional database reads for conservative full-search exhaustion and refusal when
queued ownership no longer matches.

Follow-up implemented: [eligible alternatives before the shortlist limit](ELIGIBLE_MATCH_SHORTLIST_OUTCOME.md)
filters the shared policy before the twelve-choice cap and allows those choices
through guarded selection. Batched candidate facts also replace per-alternative
detail/file reads. See that outcome for the remaining browsing recommendation.
