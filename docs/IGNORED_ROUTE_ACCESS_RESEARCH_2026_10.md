# Ignored-source access research and recommendation

Consulted 2026-10-20 using MCP discovery and opened primary sources. The guidance
below is scoped to route admission, not a platform-wide certification.

| Source and status | Applicable practice | Project application |
| --- | --- | --- |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Least privilege, deny by default and validate every request | Require exact admin role for this reviewed page, refresh cached session on entry and retain independent server enforcement. A client guard is navigation policy, not API authorization. |
| [Vue Router navigation guards](https://router.vuejs.org/guide/advanced/navigation-guards.html), official framework documentation | Global guards can await, redirect or cancel navigation before confirmation | Verify the session before page admission; use a named Home destination or cancellation on verification failure. Preserve existing auth/password ordering and real lazy-route behavior. |
| [W3C WCAG 2.2 Understanding 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative guidance | Meaningful keyboard order | Filter one unavailable link while retaining other links' relative order, names and native keyboard operation. Verify actual DOM/focus; do not claim full WCAG/assistive-technology conformance. |

Observed baseline is Vue 3.5.44/Router 5.2.0. The scoped session refresh and shared
policy are project decisions informed by these sources; none mandates this
particular module layout or a new backend permission model.

| Option | Pros | Cons |
| --- | --- | --- |
| Hide the link only | Small | Direct links still mount an unusable page. |
| Guard against cached role only | Small, no added request | Revoked admin status can still admit the shell until the cache changes. |
| **Shared scoped policy plus current-session admission** | Aligns navigation and direct entry; handles revocation; preserves APIs | One extra session read on entry with an existing cached session; network failure must refuse admission. |
| Migrate all Activity/Settings role access now | Broad consistency | Requires a separate inventory of every destination's data/actions and role contracts; risks removing valid operator paths. |

Recommended stack: **current session → shared scoped role policy → filtered
navigation / guarded route → independently authorized APIs**. Initial session
loading and other routes keep their existing behavior. A role change after page
admission remains subject to server checks on every API operation.

The fresh MCP pool contains only [PR #48](https://github.com/cloudbyday90/Harmoniarr/pull/48),
head `9898af07e914b132b7eb953eb96cde30d6ee865c`; random draw
`0.2577755236772482` selects that entry. Its complete fresh patch, lock hash and
installed language-service inputs match the retained failing TypeScript 7 Vue
candidate and passing TypeScript 6 control. The fresh local comparison passed;
the PR remains unapplied. No repeated dependency installation, merge or release
was performed for those unchanged inputs.
