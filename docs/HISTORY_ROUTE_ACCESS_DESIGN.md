# System history admission design

Date: 2026-10-21. Continues the [source-policy admission outcome](SOURCE_ROUTE_ACCESS_OUTCOME.md).
See the separate [research and recommendation stack](HISTORY_ROUTE_ACCESS_RESEARCH_2026_10.md).

System history currently mounts for operators, although its real read handler
requires an administrator. `ActivityHistoryView` calls `useActivityHistory`,
which reads `/api/v1/system/activity-feed` on mount and revalidates periodically
and on focus. Its handler calls `requireAdminSession` before building the feed.
Correct page admission without changing that API's authority or data contract.

Add `activity-history` to the existing private set in the focused ESM Activity
access policy. The global router and diagnostic navigation already share this
decision. Keep the existing initial session read, current-session verification
for cached entry, bootstrap/password-change/login ordering, Home redirection for
other roles and bounded cancellation/retry feedback on failed verification.
Unrelated routes do not gain extra session reads.

For non-admin and unknown roles, all four Source/history destinations are now
unavailable. Reuse the existing projection's empty-group filter so it omits that
section and its heading. Keep the immutable inventory for admin rendering.
Retain native disclosure and RouterLinks, descriptive labels and the relative
order of the remaining three groups. Verify native summary-to-first-link focus
and the last two available links instead of asserting focus on a removed link.
At the mobile breakpoint, verify actual Tab focus above the fixed navigation
bar before capturing the remaining group. An unfocused screenshot position
alone does not establish keyboard obstruction.
No page/component-specific permission singleton or duplicated role store is needed.

The endpoint remains independently authorized on every read, including direct
HTTP calls and requests after a mounted view's role is revoked. This change owns
new navigation, not continuous eviction of an already mounted component. Reads
must not start a search, alter source policy or submit another domain mutation.

Extend the existing owned browser cohort with System history's pending session,
actual authorized feed read, direct-link/API refusal, cached role revocation,
password-change precedence and failed verification/retry. Retain the existing
source-policy cases, history initial-load/retry controls, canonical ignored-review
return and unrelated lazy Settings navigation in one selected run. Use cheap pure
tests for the role matrix and empty-group projection, then the stable fast gate
and preserved-state no-cache Docker/readiness workflow. No new API, schema,
dependency, version, branch, release or tag is required.

Random PR review is conditional on compatibility: refresh the selected candidate,
compare its entire patch and actual consumers with retained native tooling
evidence, and do not promote a known incompatible dependency merely to resolve
its branch conflict. The separate outcome records applicability, authorized
stale-PR cleanup and limits.
