# Missing Music Find matches design

Status: Accepted for implementation
Research date: October 3, 2026

## Problem and scope

The canonical worklist maps `search_now` to **Find matches**, but the inspector
has no initial-search command. Its existing Search again action deliberately
accepts stopped retry states. Initial `queued_for_search` rows are also classified
as searching, so the default action worklist hides them.

Complete one journey: an eligible recipient finds their due, never-searched
release in the action worklist, requests Find matches, and sees the refreshed
durable search state. Reuse the existing shared discovery request and operation
worker. This slice does not change quality consent, retry/recovery rules, provider
setup, release-date policy, or download/library-add authorization.

## Official-source research

URLs were discovered through web search, official navigation, and GitHub MCP.
Sources were opened on the consultation date; that date is not their publication
date. Standards, informative guidance, and local conventions are distinct.

| Source | Applicable practice |
| --- | --- |
| [WHATWG HTML buttons](https://html.spec.whatwg.org/multipage/form-elements.html) | A native button with an explicit non-submit type provides command semantics without a custom keyboard widget. |
| [W3C keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) and [visible focus](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) | Prove keyboard activation and a visible focus indicator for the rendered action. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Expose queued/pending outcomes programmatically without requiring focus on the message. |
| [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Check focus in the actual scrolling shell and narrow layouts. |
| [W3C target-size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | AA uses 24 CSS pixels with defined exceptions; Harmoniarr retains its stronger 44-pixel mobile convention. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Recheck object/recipient authority on the server and retain session-bound CSRF for mutations. |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | Keep reads separate from the POST command; application durable replay makes uncertain retries safe, rather than assuming POST is intrinsically idempotent. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Obtain current resource state under consistent transaction locks; use a transaction-scoped advisory lock for the absent-row dispatch-start race. |
| [Vue accessibility](https://vuejs.org/guide/best-practices/accessibility) and [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) | Combine semantic/browser checks with visual/manual review and report their limits. |

These references inform the implementation. The specific eligibility and shared
queue policy below are project decisions. Focused checks are not a complete WCAG
conformance assessment or a repository-wide security audit.

## Alternatives and recommendation

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Expand Search again/reset SQL to initial searches | Small adapter change | Erases history/counters and conflates initial intent with a retry | Reject |
| Create a new per-recipient search queue | Independent scheduling | Duplicates workers and physical-release ownership | Reject |
| Dispatch without saving scoped intent | Minimal write | Cannot audit/replay recipient intent or distinguish a repeated command | Reject |
| Record scoped initial intent and dispatch existing ready work | Preserves shared policy/history and current operation infrastructure | Needs strict initial eligibility, concurrency proof, and truthful no-op feedback | Adopt |
| Only add an inspector button | Small visible change | Default worklist still hides eligible decisions | Reject |
| Derive permission and action-state classification from one policy | Discoverable and authoritative | Policy must be exercised by page filtering as well as detail reads | Adopt |

## Command and eligibility contract

Add `POST /api/v1/missing-music/decisions/:decisionId/find-matches`, accepting
`{}` with no recipient/policy fields. Keep fresh-session, CSRF, mutation rate
limits, and durable scope `missing-music.decisions.find-matches` with the decision
ID fingerprint. Resolve the target on the server: requester/operator own scope,
administrator household scope, disabled-account history read-only.

Use one pure initial-search policy for public permission, worklist classification,
and the guarded write. Require a due automatic ready request, a missing/partial
owned wanted release, no setup blocker, no blocked reason, and authoritative
never-searched evidence. Search/research counts, timestamps, search IDs/results,
retry/recovery/failure markers, and candidate history must not indicate prior or
active work. A future release/deadline, malformed unknown state, missing link,
manual request, completed/ignored release, or active candidate handoff refuses
the command. An existing selected-target initial intent removes new-action
eligibility; it does not authorize resetting the request.

Under maintenance -> account eligibility -> owned wanted -> discovery/link locks,
reread current evidence and save only `musicQueueInitialSearch` on the selected
link with required audit in the same transaction. Do not rewrite the shared
request, deadlines, counters, quality preferences, or sibling link evidence.
Different targets may independently join the same unclaimed due request.
Repeated selected-target intent under a different key is a no-op with no duplicate
audit. Return bounded `find_matches` action facts distinguishing recorded intent,
an existing queue, active dispatch, and a historical no-op; do not invent a new
search, download, or completed result.

`searchPreparationStarted` means this command saved the selected recipient's
initial intent. `searchAlreadyQueued` describes the existing automatic ready
request and is true even on the first accepted click. `intentAlreadyRecorded`
identifies a different-key no-op. `dispatchAlreadyActive` and `discoveryRunId`
describe dispatch coordination, not provider completion. Same-key replay retains
the original durable response after state advances.

After commit, request the existing discovery dispatch. Serialize its owning
start boundary with a PostgreSQL advisory transaction lock before active-run
lookup, run creation, and required audit. Preserve the existing 409 active-run
contract and translate that into truthful coalescing for this command. Audit
failure must roll back run creation. Check other producers of discovery runs
before claiming global uniqueness; retain existing deferred/recovery scheduling.
Post-commit failure leaves ready durable work for the heartbeat.

## UI and W3C behavior

Expose server-derived `permissions.canFindMatches`; never infer authorization
from a browser status label. Classify only eligible initial decisions as action,
including the server's paged filtering path. Already requested/claimed work stays
in its appropriate progress bucket.

When broad legacy projection reports `search_now` but strict initial permission
is false, the canonical public status uses `nextAction: null`. The worklist and
inspector must not advertise an unavailable Find matches action. Legacy queue
projection keeps its existing behavior.

A narrow API wrapper and composable reuse the existing per-decision mutation gate,
uncertain retry key, route/disposal guards, and refresh coordinator. Render a
native **Find matches** button and selected-recipient explanation. Keep initial
Find matches separate from stopped Search again.

Use persistent polite/atomic status feedback outside busy ancestors. Busy state
belongs to the snapshot/operation it describes. Retain fixed public errors rather
than provider/database text. After a command removes its invoking control,
provide a meaningful current-status focus destination when that control still
owns focus; do not steal focus after the user moves elsewhere. Background refresh
must preserve focus. Retain visible focus and the existing mobile target sizing.

## Evidence and adjacent work

Prove initial eligibility and default-worklist discovery, actor/target ownership,
disabled/maintenance/missing-link/history/future/active refusals, same-key replay,
different-key no-op, scoped shared intent, unchanged queue/quality/counters,
audit rollback, post-commit failure, concurrent dispatch coalescing, and worker
claim races using real PostgreSQL where SQL owns the property.

Browser evidence must cover Enter/Space activation, persistent status feedback,
pending exclusion of competing commands, refreshed progress, background focus,
user-moved focus during the request, disabled/denied state, and narrow/light/dark
rendering. Run focused tests before the full repository gate on stable source.

The requested practical web-standards skill and random PR replay have separate
design/outcome documents. Keep ESM modules small, operate on main, and create no
release, tag, hosted workflow dispatch, image publication, or PR merge.
