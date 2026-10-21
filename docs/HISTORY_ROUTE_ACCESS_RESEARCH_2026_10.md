# System history research and recommendations

Consulted 2026-10-21 through MCP search, official navigation and GitHub metadata.
Baseline: Node 24.22.0, Vue 3.5.44 and Vue Router 5.2.0. Sources are scoped to the
reviewed journey; automated focus evidence does not establish WCAG conformance.

| Official source / status | Applicable decision and evidence |
| --- | --- |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Preserve admin authorization at the real feed handler for every request. Deny absent/unknown authority in the reviewed route policy. Prove direct HTTP refusal separately from hidden navigation. |
| [Vue Router guards](https://router.vuejs.org/guide/advanced/navigation-guards.html), framework documentation | Await current-session verification before confirming entry. Reuse the global guard's existing redirect/cancel behavior, retaining its authentication precedence. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative explanation of WCAG 2.2 SC 2.4.3 | Preserve meaningful keyboard sequence after filtering. Verify the native disclosure boundary and remaining link adjacency in the actual shell. Removing an empty diagnostic group is the project's presentation choice, not a separate WCAG requirement. |
| [W3C Link Purpose](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context), informative explanation of SC 2.4.4 | Retain explicit System history and other native link labels. Do not leave a non-admin section advertising destinations it no longer contains. |
| [W3C Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), informative explanation of SC 2.4.11 | Check actual mobile Tab focus against the fixed navigation bar. The selected link is fully above the footer in this journey; this is a scoped measurement, not a general conformance claim. |
| [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), vendor release guidance | The native compiler and LSP architecture do not establish compatibility with installed consumers of the older language-service API. Evaluate actual Vue editor tooling independently of a successful compiler command. |
| [Vue TypeScript plugin README](https://github.com/vuejs/language-tools/blob/master/packages/typescript-plugin/README.md), upstream tooling documentation | The plugin's tsserver integration is relevant to the installed classic tooling. Current upstream changes cannot be assumed to exist in the pinned local consumer versions. Retained project candidate/control evidence owns this compatibility decision. |

W3C supplies interaction/semantics guidance; OWASP supplies authorization
principles; framework and vendor documentation supply execution contracts.
Their roles are complementary. None makes a browser guard an API security
boundary or turns an untested toolchain migration into a safe dependency bump.

## Alternatives and recommendation stack

| Option | Benefits | Costs / limits | Recommendation |
| --- | --- | --- | --- |
| Hide System history's link only | Small presentation change | Direct URLs still mount a refused page; cached role may be stale | Insufficient |
| Extend the shared reviewed policy | One decision controls admission and links; current session precedes mount; existing empty-group handling is reused | One verification read per protected entry; mounted views still rely on API checks | Implement |
| Add a separate check to the view | Locally visible permission logic | Duplicates the guard and can run after mount reads | Reject |
| Rewrite all Activity/Settings permissions now | Potential broader consistency | Unreviewed API contracts and unrelated journeys increase risk | Defer to scoped follow-ups |
| Apply selected TypeScript 7 PR immediately | Potential native tooling speedups | Installed Vue consumers failed retained qualification; branch conflict resolution alone cannot repair compatibility | Defer pending coordinated tooling qualification |

Selected stack: independent server authorization; shared ESM route policy;
current-session admission; role-aware native links and omission of empty groups;
cheap policy/projection tests plus one combined real browser cohort; stable fast
gate; preserved no-cache Docker readiness. This keeps the implementation small
while testing the boundaries that own the behavior.

Random draw: two open PRs (#54 and #48), draw 0.6599774727349316, zero-based index
1 selected [PR #48](https://github.com/cloudbyday90/Harmoniarr/pull/48). Reviewed
head `9898af07e914b132b7eb953eb96cde30d6ee865c` proposes TypeScript 6.0.3 to
7.0.2. The initial snapshot reported conflicts; mergeability changed across
snapshots and is not the compatibility decision. The
[outcome](HISTORY_ROUTE_ACCESS_OUTCOME.md) records fresh patch/input comparisons,
retained native evidence and closure without merging under the user's earlier
stale-PR cleanup instruction. Rebasing alone cannot repair the tooling failure.
