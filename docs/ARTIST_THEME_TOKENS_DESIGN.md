# Artist and release-detail theme token design

Reviewed September 12, 2026. Harmoniarr uses a shared light/dark design system for its library-management console.

## Findings and decision

The artist view and adjacent release components reference defined tokens. The release modal contains four undefined names: --hx-bg-muted, --hx-text-subtle, --hx-color-success, and --hx-text-danger. CSS variable failure can invalidate the declaration, leaving unintended inherited or initial values.

Replace muted backgrounds with --hx-bg-surface-muted and secondary text with --hx-text-muted. For ownership indicators, mix --hx-success (80%) with --hx-text (20%); pure success has only about 2.98:1 contrast against the light muted surface. For error text, mix --hx-danger and --hx-text evenly to preserve semantic hue with readable text in both themes. Use --hx-accent-strong for modal focus outlines; the normal accent has only about 2.36:1 contrast against white. Scope these changes to the modal rather than altering global tokens and every consumer.

## Options and final stack

| Option | Pros | Cons |
| --- | --- | --- |
| Existing semantic tokens with scoped state mixtures (chosen) | Small blast radius; follows both themes; preserves state meaning | Computed colors need runtime contrast verification |
| Define global aliases for missing names | Minimal template edits | Masks vocabulary drift and expands global API |
| Hard-code light/dark colors in the component | Direct control | Duplicates theme policy and increases maintenance |
| Redesign global color tokens | Can improve every surface | Requires whole-platform visual regression work beyond this issue |

Final stack: existing CSS custom properties → scoped modal CSS and color-mix → browser computed-color, contrast, and keyboard checks. No new JavaScript runtime module, dependency, API, or permission path is needed. Tests remain ESM and shared test helpers remain small and separate.

## Official research

Sources discovered and opened through tools as of September 12, 2026:

- [CSS Custom Properties](https://www.w3.org/TR/css-variables-1/): missing variables without valid fallbacks invalidate declarations at computed-value time.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): normal text requires 4.5:1 contrast; large text 3:1.
- [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast?locale=en_GB): necessary control/state indicators and authored focus indicators require 3:1 against adjacent colors, not every decorative border.
- [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) and [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum): retain visible, unobscured keyboard focus.
- [Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html): the stronger focus-area criterion is AAA; this slice does not claim full WCAG conformance.

## Open PR review

GitHub MCP refreshed all open PRs and complete patches. #40 head `649659f1e199d48d55cc8d5cccf9f079dc235d86` is an unrelated Node-major fixture update. #24 head `40cf4d117b69bd55b9a0a7353361838216e1e952` and #23 head `ae651337286216e92be7ae977e39fcedc14de7f9` are superseded by newer local action versions. No applicable patch was applied or merged.
