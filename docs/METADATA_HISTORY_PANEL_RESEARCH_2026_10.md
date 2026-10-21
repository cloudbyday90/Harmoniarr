# Metadata history panel research and recommendations

Consulted 2026-10-21 through MCP search and official primary-source reads.
Installed Node/Vue/Router versions are checked again before publication.

| Official source / status | Application |
| --- | --- |
| [WCAG 2.2 Reflow](https://www.w3.org/TR/WCAG22/#reflow), normative criterion, and [Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), informative explanation | Fit text and controls into a narrow viewport with vertical reading. A 320 CSS px check is selected evidence, not whole-page or actual browser-zoom certification. |
| [W3C C32](https://www.w3.org/WAI/WCAG22/Techniques/css/C32), informative technique | Use CSS grid/media queries to reflow finite cards without rearranging source order. The exact three/two/one layout is a project decision. |
| [WAI Labeling Regions](https://www.w3.org/WAI/tutorials/page-structure/labels/), informative tutorial | Name history through its existing visible heading; use a concise summary label where there is no single group heading. |
| [Vue useId](https://vuejs.org/api/composition-api-helpers.html), framework documentation | Allocate the panel heading ID once during setup. Multiple component instances receive distinct application IDs. |
| [Vue template refs](https://vuejs.org/guide/essentials/template-refs), framework documentation | Keep the panel private except for the small exposed heading accessor needed by owned focus; account for unmounted refs. |

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Span the existing history card across all stats columns | Small CSS patch | Summary still owns growing history and its focus/feedback API; shared odd-card behavior remains | Reject |
| Separate history panel with existing workspace scrolling | Full event width, finite summary, clear component and heading ownership | Move props/ref wiring and qualify responsive/focus consumers | Implement |
| Fixed-height history with nested scrolling | Bounds visible height | Another scroll context and keyboard/zoom qualification burden | Defer |
| Collapsed history or virtualization | Could reduce long-page rendering | New interaction/state semantics without measured need; could hide focus targets | Defer |

Recommended stack: current authenticated bounded reads and generations; finite
summary grid; sibling named history section; unchanged entry/time/status markup;
small exposed heading accessor and owned focus adapter; native geometry and
interaction evidence; exact final artifacts; preserved Docker readiness.
These sources inform presentation decisions, not server permissions. No domain
mutation, dependency or security-policy change is needed. MCP returned zero open
PRs; no random candidate, rebase, merge or stale closure was applicable.
