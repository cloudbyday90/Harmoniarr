# Library labels: official research

Consulted October 28, 2026 through MCP search and official navigation. The built
Library DOM has 24 unassociated field labels, five existing explicit associations
and two distinct retention settings sharing the visible label Max age (days).

| Source and status | Selected practice | Observable boundary |
| --- | --- | --- |
| [W3C H44](https://www.w3.org/WAI/WCAG22/Techniques/html/H44), published informative WCAG 2.2 technique | Link visible labels to controls with matching unique for/id values. Techniques are examples, not mandatory implementations or conformance certification. | Native label.control/control.labels, accessible-name and pointer checks on all 29 fields |
| [WAI grouping tutorial](https://www.w3.org/WAI/tutorials/forms/grouping/), informative guidance | Group related fields visually and programmatically using fieldset and legend. | Separate Operation runs and Outcome events groups distinguish the repeated age label |
| [WHATWG labels](https://html.spec.whatwg.org/multipage/forms.html) and [form elements](https://html.spec.whatwg.org/multipage/form-elements.html), normative Living Standard | Native labels reference labelable controls; fieldsets and legends carry group semantics. | Existing native controls and the shared SettingsFormGroup component retain behavior |
| [Vue accessibility](https://vuejs.org/guide/best-practices/accessibility.html), framework guidance | Use visible semantic labels; repeated components need instance-owned IDs. | Route-prefixed IDs for the single Library route; no competing aria-label or new ID registry |

The published H44 page was reached through the editor draft's published-version
link. Vue 3.5.44 supports useId, but no repeated input component is introduced.

## Options, pros and cons

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Explicit labels with route-owned IDs | Native activation and names; no runtime/dependency | IDs need uniqueness if future components repeat | Implement all 24 missing pairs |
| Reuse SettingsFormGroup for retention | Native context for the two age fields; existing component/style owner | Small retention spacing/title presentation change | Implement two groups and verify reflow |
| ARIA names/groups everywhere | Can expose names without restructuring | Duplicates visible copy and native behavior; label clicks remain unlinked | Do not use for these native fields |
| New generic input abstraction with useId | Useful for repeated reusable fields | Adds model/attribute forwarding and broader migration for a metadata repair | Defer until repeatable ownership is needed |

Final stack: native controls and labels, route-owned IDs, the existing native
form-group component, scoped draft/save ownership, and modular ESM browser proof.
Keep numeric constraints, reset actions, warning copy and server authorization
unchanged. A label or local draft never grants cleanup, acquisition or naming
publication authority. Fixture mutations are blocked; settings are compared
privately before/after the walkthrough. See [design](LIBRARY_LABELS_DESIGN.md)
and [outcome](LIBRARY_LABELS_OUTCOME.md).
