# Connections labels: official research

Consulted October 28, 2026 through MCP search and official navigation. Scope:
the ten Connections fields with visible sibling labels but no native association.

| Source and status | Applicable practice | Implementation and evidence |
| --- | --- | --- |
| [WHATWG HTML label](https://html.spec.whatwg.org/multipage/forms.html), normative Living Standard | Explicit labels reference a labelable control in the same tree; duplicate IDs can select the wrong target. Implicit wrapping labels are also supported. | Add matching for/id pairs; inspect native label.control/control.labels and document ID uniqueness. |
| [W3C H44](https://www.w3.org/WAI/WCAG22/Techniques/html/H44), published informative WCAG 2.2 technique | Keep visible labels and explicitly associate text, password, numeric, select and textarea controls. Label activation enlarges the interaction area. Techniques are examples, not mandatory implementations or conformance certification. | Verify visible text equals accessible name, click-to-focus and existing checkbox/radio wrapping labels in Chromium. |
| [Vue accessibility](https://vuejs.org/guide/best-practices/accessibility.html), framework guidance | Native labels expose the purpose of a control; placeholders are insufficient substitutes for persistent labels. | Retain existing visible copy and write-only placeholders; avoid a competing aria-label. |
| [Vue useId](https://vuejs.org/api/composition-api-helpers.html), framework API documentation | Provides stable IDs per application/component instance for reusable fields. | Consider when extracting repeatable components; this route has one mounted Connections form with existing route-prefixed IDs. |
| [Playwright label retargeting](https://playwright.dev/docs/other-locators), tool documentation | Input actions can retarget a label to its associated control. | Use name/label locators for field assertions; the disabled-label pointer check must not wait for the disabled control to become enabled. |

The published H44 page was reached from the editor draft's published-version
link. No draft was treated as a normative Recommendation. Installed Vue is
3.5.44; useId is available, but is unnecessary for this single route instance.

## Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Route-prefixed native for/id pairs | Small declarative fix; native focus and naming; no extra runtime or changed serialization | IDs must stay unique if fields later become repeatable | Implement, with a built-document duplicate-ID check |
| Wrapping all fields in labels | Native association without IDs | Changes established field markup/layout; no benefit over existing sibling labels | Retain only for existing checkbox/radio controls |
| aria-label on every field | Supplies an accessible name | Duplicates visible copy and does not link label activation | Reject for these already-visible labels |
| New generic field component with useId | Supports repeatable instances | Adds a component/model/attribute API for a ten-attribute-pair repair | Defer until repeatable ownership is needed |

Final recommendation stack: existing semantic controls, visible native labels,
route-owned unique IDs, browser-level name/activation checks, unchanged scoped
settings drafts and guarded server commands. This is a local improvement, not
whole-application WCAG or screen-reader acceptance.

Security scope is a project decision: keep secret values write-only, retain native
password types/autocomplete/disabled bindings, and block all fixture mutations.
Label metadata grants no server permission. No dependency or backend service is
needed. See the separate [design](CONNECTIONS_LABELS_DESIGN.md) and
[outcome](CONNECTIONS_LABELS_OUTCOME.md).
