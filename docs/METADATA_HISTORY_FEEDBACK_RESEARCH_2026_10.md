# Metadata history feedback research and recommendations

Consulted 2026-10-21 through MCP search and primary-source reads. Installed
baseline: Node 24.22.0, Vue 3.5.44, Vue Router 5.2.0; final verification checks it.
See the [design](METADATA_HISTORY_FEEDBACK_DESIGN.md) for implementation ownership.

| Official source / status | Applicable decision |
| --- | --- |
| [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22), informative technique | Establish a status container before messages occur, with polite/atomic behavior. Keep progress/error feedback separate from focus management. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative WCAG 2.2 explanation | Preserve understandable keyboard navigation when dynamic content removes its invoker. The specific heading destination is a project design choice. |
| [Vue nextTick](https://vuejs.org/api/general.html), framework documentation | Wait for the DOM update before testing whether the button survives or focusing the heading. Recheck ownership after that await. |
| [WHATWG HTML focus management](https://html.spec.whatwg.org/multipage/interaction.html), normative living standard, updated October 20, 2026 | Use programmatic focus with a negative tabindex for a non-tab-stop destination. Preserve scroll for the invoker; allow the completion heading to scroll into view. |

The live-region and focus mechanisms address separate needs. W3C does not
prescribe this component/ref API or certify these tests. Reusing current-page
authority and retaining authenticated bounded GETs are project security
invariants; a completion predicate is not a server permission.

| Option | Pros | Cons / limits | Decision |
| --- | --- | --- | --- |
| Always focus the status or heading after every response | Simple | Interrupts a user who moved elsewhere; conflates announcements with focus | Reject |
| Keep an exhausted disabled Load more button | Preserves a visual anchor | Disabled controls may blur; keeps an unavailable action and does not provide completion feedback | Reject |
| Stable polite status plus generation/interaction-owned focus | Explains progress/errors, preserves user movement and handles a disappearing invoker | Explicit completion/ref wiring; requires browser and assistive-technology qualification | Implement |
| Global toast/focus manager | Could serve unrelated features | More coupling and unnecessary migration | Defer |

Recommended stack: unchanged authenticated bounded reads; existing workspace/page
generations; current structured completion and status; stable polite/atomic
container outside busy content; nextTick and repeated currency check; existing
interaction tracker; meaningful surviving focus target; focused/native browser
checks and visual inspection; stable fast gate; preserved no-cache readiness.

MCP returned zero open PRs. No random candidate was available to implement locally,
merge or rebase this round.
