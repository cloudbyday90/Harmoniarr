# Release dialog heading design

Reviewed September 12, 2026. Harmoniarr release details support edition preview and library curation; the dialog must identify the release before its asynchronous details finish loading.

## Decision

Move the release title into a persistent visible h2 in the dialog header and reference that heading through aria-labelledby. Remove the duplicate hero title. Use the loaded release title when nonblank, otherwise the supplied card title, otherwise `Release details`. Keep text interpolation (no HTML insertion). A per-instance Vue-generated ID avoids collisions between mounted dialogs.

Retain existing Close-first focus, Escape handling, focus containment, and restoration to the opener. Async title updates do not move focus or add live announcements; loading and error feedback remain in their existing regions. Do not concatenate the whole structured body into aria-describedby.

Wrap long titles, cap the visible heading at three lines, and keep Close from shrinking. The complete title remains in the accessibility tree and supplemental title tooltip. The header remains present during loading and errors.

## Options and final stack

| Option | Pros | Cons |
| --- | --- | --- |
| Visible heading and aria-labelledby (chosen) | One naming source; release identity visible and accessible | Browser locators using the former generic name must change |
| Hidden generic heading | Stable test selector | Empty visual header and poor release identification |
| Independent aria-label plus hero title | Small visual change | Duplicated naming logic can diverge |
| Focus heading whenever data loads | Draws attention to updated title | Steals focus during asynchronous interactions |

Final stack: existing release/title props → Vue computed fallback and useId → semantic header → existing dialog lifecycle. No new service, API, dependency, or persistence behavior. Native ESM remains the code format.

## Official research

Discovered and opened through tools as of September 12, 2026:

- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): visible title referenced by aria-labelledby, focus containment, and return focus.
- [WAI-ARIA](https://www.w3.org/TR/wai-aria/): accessible naming and dialog semantics.
- [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): status information should not require moving focus.

- [Vue useId](https://vuejs.org/api/composition-api-helpers#useid): setup-time per-instance IDs; installed Vue 3.5.41 supports this without an upgrade.

## PR review

GitHub MCP refreshed all open PRs and full patches. #40 head `649659f1e199d48d55cc8d5cccf9f079dc235d86` is an unrelated Node-major fixture change. #24 head `40cf4d117b69bd55b9a0a7353361838216e1e952` and #23 head `ae651337286216e92be7ae977e39fcedc14de7f9` are superseded by newer local action versions. No applicable patch was applied or merged.
