# Eligible quality-review pages: outcome

Implemented October 24, 2026 on main. See the [design](ELIGIBLE_MATCH_PAGINATION_DESIGN.md)
and [official-source research, pros/cons and stack](ELIGIBLE_MATCH_PAGINATION_RESEARCH.md).

## Delivered behavior

The existing Choose another match disclosure now offers First page, Previous
matches and Next matches. Each page replaces at most twelve eligible choices;
the browser retains one page and one accepted cursor. Stable native navigation
buttons retain focus at terminal pages, and a persistent polite status region
announces deliberate navigation or a stale-page reset. Background polling leaves
focused match controls enabled and does not move focus.

The authenticated, rate-limited detail GET accepts `matchCursor`. The shared
scope service rechecks current recipients and effective quality/track policy,
then reads narrow fifty-row UUID keysets in either direction with thirteen-match
lookahead. A small ESM policy authenticates fifteen-minute continuations using
HMAC-SHA-256 and a process-local random key. Actor/role, target, failed acquisition,
search and current participant/policy facts bind the cursor. Restart, expiry,
tampering or changed context returns a bounded conflict; the client retries the
first page once. Cursor contents expose only public anchor/direction/expiry and
a digest, not private policy or recipient facts.

Polling retains the accepted page. Explicit Refresh and completed commands return
first. Failed navigation retains the last accepted choices and cursor; later
responses from superseded reads cannot replace data or status. Route changes,
hidden tabs, commands and disposal invalidate pending reads. A continuation with
no remaining choices restarts first rather than granting Search again. Full
initial exhaustion and the guarded one-match existence check retain their policy.

Selection still uses the existing fresh transactional guard, atomic event/audit
and explicit download command. Page membership never authorizes selection. No
dependency, migration, endpoint, separate app, branch, version bump, tag or release
was introduced.

## Executed validation

- Final focused checks: **86 passed**. Cursor tampering, malformed/oversized input,
  expiry, alternate key and context binding; sparse forward/reverse traversal;
  current SQL projection; client cancellation, stale response/status refusal,
  failure retention, first-page reset and separate background/navigation state.
- Final full fast gate: **11,088 passed**: 5,911 server, 4,477 client and 700 script
  tests, with zero failures, cancellations or skips. Lint, copyright, ESM, schema,
  Compose policies and client/server builds passed. A final focus-only adjustment
  prompted a new complete gate; counts are not summed across runs.
- PostgreSQL/HTTP: **18 passed** across pagination, shortlist, selection and
  restart. New cases traverse all twenty-five eligible choices beyond fifty-one
  weak results, reverse without duplicate/omitted stable IDs, select a later
  choice without a transfer, refuse foreign actor/target and changed participant
  policy, reject tampering/duplicate cursor values, and distinguish an empty
  continuation from global exhaustion. This cohort preceded the final client-only
  focus refinement; frozen per-file hashes confirm unchanged server/shared/SQL
  fixtures. Its result is retained rather than rerunning the same database work.
- Standards/testing skills passed the skill-creator validator. Their new scoped
  pagination reference connects W3C focus/status, OWASP request authorization,
  PostgreSQL ordering and concrete validation boundaries.
- Final browser cohort: **30 passed** across six suites, including the existing
  twenty-four detail acceptance cases. The new real-app case proves twelve/one
  result replacement, keyboard forward/reverse terminal focus, explicit Refresh,
  later-page selection without download and a held actual HTTP background refresh
  that leaves the focused match button enabled. No synthetic response replaces
  that held request; it continues to the real application.

The fixtures use controlled candidates and an injected media gate. They establish
UI/HTTP/SQL authority, not live provider discovery or measured audio. Manual
screen-reader and physical-device acceptance remain deferred. Packaged native
media and preserved deployment evidence belong to the separate
[Docker outcome](LOCAL_DOCKER_MATCH_PAGINATION_OUTCOME.md).

GitHub MCP found zero open PRs at initial selection and final recheck. No applicable
random PR, merge or stale-PR rebase was available.

## Recommendation and next item

Keep the existing Vue detail/request owner, bounded public projection, ESM cursor
policy, shared eligibility service, parameterized PostgreSQL store and independent
transactional selection. The benefit is broader comparison with bounded retained
facts and DOM; the tradeoff is current-view pagination and cursor reset on policy
change, expiry or server restart. No frozen candidate snapshot is retained.

The following [scan-budget slice](ELIGIBLE_MATCH_SCAN_BUDGET_OUTCOME.md) now bounds
detail-read candidate facts with explicit incomplete windows and preserves the
complete fresh command guard. Its outcome owns the current next recommendation.
It also replaces this slice's empty-continuation reset with explicit current-view
EOF navigation; this document retains the original implementation evidence.
