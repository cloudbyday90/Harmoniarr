# Search correction research and recommendation

Consulted 2026-10-20 through MCP web search and opened primary results. Guidance
below is current to that consultation; this is not a blanket conformance claim.

| Source and status | Applicable practice | Project decision |
| --- | --- | --- |
| [W3C WCAG 2.2 Understanding 2.4.4](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html?trk=public_post_comment-text), informative guidance | Link names and associated context explain their purpose | Use explicit Review ignored sources / Review provider connection links next to fixed cause guidance. Browser-check keyboard activation and visible focus. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Deny by default, apply object/function authority and validate each request | Derive review capabilities from the authenticated administrator and active recipient. Missing flags deny links; existing destination endpoints independently enforce admin access. |
| [IETF RFC 9110 section 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html), Internet Standard HTTP semantics | Safe methods have read-only intended semantics | Navigation/read projections do not request policy changes or new searches. Existing explicit mutations remain separate. |

The server-derived capability design and separate response/file facts are project
applications of these sources. W3C does not prescribe this permission schema;
OWASP does not certify a client link as an authorization boundary. Browser DOM
checks alone do not establish assistive-technology output or full WCAG compliance.

| Option | Pros | Cons |
| --- | --- | --- |
| Link all readers to both pages | Few changes | Sends requesters/operators into admin API refusals and ignores recipient state/cause. |
| Use client session role only | Simple, follows the current shell | Duplicates the role decision and misses the authorized detail/recipient boundary. |
| **Server capabilities plus a focused presenter** | Current actor/recipient/cause mapping; deny by default; small modules; no new commands | Two DTO booleans and adapter tests; explicit enforcement still belongs to destination endpoints. |
| Inline unignore, provider changes or automatic retry | Fewer navigation steps | New global-policy and mutation scope; a count cannot identify a safe source or justify a fresh search. |

Recommended stack: **authorized release detail → bounded cause evidence → strict
review capabilities → fixed internal destinations → existing explicit commands**.
Keep global source policy and connection review with administrators; give other
readers useful escalation guidance. Reuse the existing bounded Settings return
context without adding arbitrary redirects or claiming a connection repair.

The fresh MCP PR pool contains only [PR #48](https://github.com/cloudbyday90/Harmoniarr/pull/48).
Random draw 0.03776307634367582 selects that sole entry. Its head remains
`9898af07e914b132b7eb953eb96cde30d6ee865c`. The complete fresh patch, lock hash and
installed consumer versions match the retained failing TypeScript 7/Vue
language-service candidate and passing TypeScript 6 control. The local comparison
passed; the PR remains unapplied. This reuses unchanged consumer evidence instead
of repeating a dependency installation. No merge or release is part of this work.
