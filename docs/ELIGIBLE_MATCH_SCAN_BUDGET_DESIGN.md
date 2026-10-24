# Bounded quality-review detail scanning

Designed October 24, 2026. Extends [scoped pagination](ELIGIBLE_MATCH_PAGINATION_DESIGN.md).
See the separate [research and tradeoffs](ELIGIBLE_MATCH_SCAN_BUDGET_RESEARCH.md).

## Contract

One authenticated detail GET may fetch at most 200 candidate facts in four
fifty-row keyset queries. It may stop earlier after thirteen eligible facts,
retaining twelve choices plus one lookahead. A small ESM scanner reports checked
and fetched counts, page reads, boundary IDs and exhaustion to its owning page
service. Those diagnostics stay private; the public page adds only incomplete
status and direction to its existing signed navigation cursors.

Budget exhaustion is not search exhaustion. An empty or short incomplete window
keeps the existing disclosure/navigation visible and offers Continue checking
matches. Forward and backward windows use exclusive last-checked boundaries;
lookahead pages retain the last visible match boundary so no eligible choice is
skipped. An exact 200-row boundary requires a later request to establish EOF.
An empty EOF window uses an inclusive reverse boundary to retain the preceding
boundary match; later batch queries return to exclusive keysets. First page stays
available after any continuation, including reverse EOF, to begin a fresh walk.
Client state still replaces twelve choices and one accepted cursor. There is no
automatic request chain, accumulated array or cursor history.
Once rediscovery is queued, detail reads retire the old match windows and reject
their cursors without rescanning the old candidate set.

## Authority and completion

Cursors retain actor/role, target, failed-search and current shared-policy binding,
signature, expiry and identifier validation. Their versioned payload also records
whether a forward walk began at the start and has observed no eligible choice.
Only complete EOF for that empty forward walk can suggest Search again. Partial
windows, reverse navigation and walks that saw a choice cannot imply exhaustion.

This is a current-view walk, not a frozen database snapshot. Candidate changes
behind the cursor can invalidate a browsing inference. The Search again command
therefore retains its independent fresh, complete transactional existence check;
it never accepts cursor history as write authority. That guard can still traverse
the entire search. This slice bounds detail-read candidate materialization and
policy evaluations, not mutation work, total SQL work, latency, bytes or RSS.
Current scope preparation and other detail queries also retain their own costs.

## Ownership and verification

Extract scanner and page orchestration into small factory services. The scope
owner retains current recipient/quality eligibility and write locks; the narrow
store retains parameterized SQL. Preserve selection/audit/download boundaries.

Use native stable buttons, explicit continuation and persistent polite feedback.
Incomplete empty windows must survive normalization, disclosure and refresh.
Background reads keep focus and never traverse more windows automatically.

Prove four-query/200-fact bounds, exact EOF, lookahead, sparse forward/reverse
progress and private diagnostic exclusion. Real PostgreSQL/HTTP must find a match
after the budget, refuse direct restart while it exists, allow a truly exhausted
walk to request guarded restart and refuse a stale empty walk after a new eligible
choice appears behind its cursor. Browser proof includes empty-window keyboard
continuation, focus, refresh and later selection without download.
