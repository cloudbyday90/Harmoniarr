# Connections layout research

Consulted October 28, 2026 through Search/GitHub MCP. These source URLs were
discovered and opened. Initial GitHub search found no open repository PRs.

| Official source/status | Applicable practice | Decision |
| --- | --- | --- |
| [CSS Flexbox](https://www.w3.org/TR/css-flexbox/), specification | Flex basis sizes the main axis, which changes with column direction. | Keep base/responsive rules together; mobile fields use content height and stretch across the row. |
| [W3C Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), informative explanation of WCAG 2.2 SC 2.4.11 | Author-created sticky content must not entirely hide the focused component. | Verify native Tab/Shift+Tab without centering each target first. |
| [W3C C43](https://www.w3.org/WAI/WCAG22/Techniques/css/C43), informative technique | Scroll padding reserves viewing space; unfixing on small screens avoids consuming the viewport. | Reserve actual sticky height and breathing room; use normal flow on mobile/short screens or when the bar exceeds half the scrollport. |
| [W3C Reflow explanation](https://w3c.github.io/wcag/understanding/reflow.html), informative | Sticky content can obstruct reflow and reading. | Test narrow reflow and actual 400% Chromium tab zoom separately. |
| [Resize Observer](https://www.w3.org/TR/resize-observer/), published Working Draft | Observe border-box changes and disconnect observation. | Measure wrapped feedback with a scoped observer rather than a constant height. |
| [Vue lifecycle](https://vuejs.org/api/composition-api-lifecycle), official documentation | Mount owns DOM effects; unmount retires them. | Retire the observer, listener and owned CSS reservation with the save bar. |
| [W3C H44](https://www.w3.org/WAI/WCAG22/Techniques/html/H44), informative technique | Associate visible labels through matching for/id values. | Audit the existing Connections field label associations as a separate next item; layout acceptance does not establish accessible names. |

## Options and recommended stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Per-view mobile overrides | Small initial patch | Leaves the shared cascade defect and duplicate fixes | Reject |
| Remove sticky behavior everywhere | No overlap | Loses convenient save access on long desktop forms | Reject |
| Fixed clearance constant | Small CSS change | Incorrect when feedback wraps or actions change | Reject |
| Cohesive row CSS and scoped measured clearance | Shared fix, native scrolling, wrapping/retirement ownership | Small DOM owner and explicit normal-flow policy | Implement |

Recommended stack: modular form-row CSS, the existing save-bar component, a small
ESM clearance service scoped to its scroll container, and CSS scroll padding.
Preserve native focus and existing save/authorization ownership. No API, session,
CSRF, schema, dependency or deployed-service change is required. This policy is
derived from the sources; geometry does not certify complete WCAG/manual AT acceptance.

See separate [design](CONNECTIONS_LAYOUT_DESIGN.md) and
[outcome](CONNECTIONS_LAYOUT_OUTCOME.md).
