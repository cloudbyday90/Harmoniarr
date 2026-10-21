# Ignored-source return research and recommendation

Consulted 2026-10-20 through MCP search and opened primary URLs. The following
guidance is current to that consultation, not a blanket conformance assessment.

| Source and status | Applicable practice | Implementation/evidence |
| --- | --- | --- |
| [W3C WCAG 2.2 Understanding 2.4.4](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html?trk=public_post_comment-text), informative | Explain the link destination with its name/context | Return to Missing Music in a release-specific card; keyboard Enter reaches the originating decision. |
| [W3C Understanding 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative | Preserve meaningful keyboard navigation order | Native links, visible focus and the existing inspector heading focus on arrival; browser checks have narrower scope than full WCAG/assistive-technology conformance. |
| [OWASP Unvalidated Redirects and Forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html), informative security guidance | Avoid arbitrary return URLs; validate approved destinations and authorization | A fixed client route with a bounded identifier, exact context and role check; the existing server detail API independently checks access. This is a project application, not the server-side mapping OWASP prefers for server redirects. |
| [Vue Router data fetching](https://router.vuejs.org/guide/advanced/data-fetching), official framework guidance | Fetch after navigation with loading/error states, watch the relevant route identity | Reuse the existing immediate detail composable on mount rather than adding refresh flags or duplicate fetching. Verify its fresh HTTP read in the actual app shell. |

Observed local versions are Vue 3.5.44 and Vue Router 5.2.0. The official guide
permits fetching before or after navigation; it does not mandate this project's
existing lifecycle. This link uses SPA navigation, not an HTTP redirect or any
new domain mutation. Route query state never grants access to another account.

| Option | Pros | Cons |
| --- | --- | --- |
| Browser Back only | No implementation | Origin is lost on reload/direct entry; no explicit product return action. |
| Arbitrary return URL/history callback | Flexible | Untrusted destination surface, unpredictable history and fragile reload behavior. |
| **Fixed context/ID plus existing detail lifecycle** | Bounded, reloadable and explicit; uses current server scope; small modules | A navigation helper/card and pending-state wiring; malformed context intentionally omits the link. |
| Automatically return/retry after unignore | Fewer clicks | Review does not imply correction or fresh-search consent; interrupts further review and conflates global policy with one release. |

Recommended stack: **authorized correction link → bounded internal context →
administrator review → explicit return → existing scoped detail read → explicit
next command**. Do not infer a fresh search from either policy correction or return.

The fresh MCP PR pool contains only [PR #48](https://github.com/cloudbyday90/Harmoniarr/pull/48),
head `9898af07e914b132b7eb953eb96cde30d6ee865c`. Random draw
`0.10224001072697442` selected that sole entry. Its complete fresh patch, lock hash
and installed language-service consumer versions match the retained failing
TypeScript 7 candidate and passing TypeScript 6 control. The local comparison
passed; the PR remains unapplied. Reusing unchanged consumer evidence avoids a
redundant dependency installation. No merge or release is part of this work.
