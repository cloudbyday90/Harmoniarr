# Eligible quality-review match pagination

The subsequent [bounded-scan design](ELIGIBLE_MATCH_SCAN_BUDGET_DESIGN.md) extends
this contract with incomplete empty windows and explicit EOF navigation. It keeps
the independent fresh write guards described here.

Designed October 24, 2026. Builds on the [eligible shortlist](ELIGIBLE_MATCH_SHORTLIST_DESIGN.md).
The [research](ELIGIBLE_MATCH_PAGINATION_RESEARCH.md) records the alternatives.

## Behavior and boundaries

The existing Missing Music detail GET accepts an optional `matchCursor`. The
existing review disclosure shows at most twelve eligible matches, replacing the
page on Next, Previous or First page. No client cursor history or accumulated
match array is retained. Native buttons keep their place in the DOM; status text
announces loading and completion without moving focus. Selection stays explicit
and starts no download.

The shared scope owner scans fifty-row keyset batches, collecting thirteen
eligible facts for lookahead. Reverse traversal uses the same eligibility policy
and reverses the retained page into ascending UUID order. No alternative file
details or provider bodies are loaded. This bounds retained page facts and DOM
items, but sparse searches can still require complete traversal; it is not a
wall-time or database-work bound.

## Cursor and authority

A small ESM cursor policy signs versioned, short-lived cursors with a random
process-local HMAC key. The payload contains only a public candidate anchor,
direction, expiry and a one-way context digest. It is authenticated, not encrypted.
The digest binds actor identity/role, target, failed acquisition/search, original
recipient set, current participant facts and effective quality/track policy.
Tampering, expiry, restart and scope changes refuse continuation. Current target
authorization runs before cursor processing on every detail read. Cursors never
authorize selection; existing transaction locks and fresh selection checks remain.

Pages reflect current eligible candidates, not a frozen snapshot. Concurrent
status changes can shrink pages. An empty continuation restarts from the current
first page rather than implying that all eligible matches are exhausted. Search
again is offered only after the existing complete first-page exhaustion check.

## Client lifecycle

The existing detail request gate also owns pagination. Poll/focus reads retain
the accepted page cursor; explicit Refresh and completed commands return to the
first page. Navigation supersedes older reads. Failed requests retain the last
accepted page and cursor. A refused continuation retries the first page once in
the same lifecycle and announces the reset. Route changes, mutations, visibility
loss and disposal invalidate pending reads. No separate app/service is needed.

## Verification plan

Test cursor tampering/expiry/context binding, forward/reverse sparse traversal,
current authorization and policy invalidation through real PostgreSQL/HTTP.
Exercise browser keyboard pagination, bounded results, refresh and selection on a
later page. Cover client stale responses and failure retention. Run focused tests
before one stable fast gate and affected SQL/browser lanes. Rebuild preserved
Docker without cache and compare the exact runtime before retaining unrelated
native memory evidence. Record executed results in a separate outcome document.
