# Storage labels and row identity: official research

Consulted October 28, 2026 through MCP search and official navigation. The
configured Storage DOM has 11 unlinked labels; additional user-folder rows expose
two more label types. Both repeatable lists currently use position-based keys.

| Source and status | Applicable practice | Implementation/evidence |
| --- | --- | --- |
| [W3C H44](https://www.w3.org/WAI/WCAG22/Techniques/html/H44), published informative WCAG 2.2 technique | Associate visible labels with controls using matching unique IDs. Techniques are examples, not conformance certification. | Native associations, accessible names and real label activation |
| [WAI grouping](https://www.w3.org/WAI/tutorials/forms/grouping/), informative guidance | Give related repeated fields a semantic group and legend. | Existing SettingsFormGroup names each translation/folder row |
| [Vue list state](https://vuejs.org/guide/essentials/list) and [key API](https://vuejs.org/api/built-in-special-attributes), framework contracts | Stateful inputs/components need stable primitive keys; the API permits symbols. Editable values and array positions do not establish row identity. | View-owned weak object identity survives edits and preceding-row removal |
| [Vue useId](https://vuejs.org/api/composition-api-helpers.html), framework API | Generate unique application IDs at component setup for repeated form elements. | Each row component owns two label/input IDs |
| [Vue component models](https://vuejs.org/guide/components/v-model), framework API | Named models synchronize individual parent-owned fields; required models avoid independent defaults. | Two explicit string models per row; saved form objects remain parent-owned |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative WCAG guidance | Dynamic controls should preserve a logical, operable focus sequence. | Project policy: after an owned removal, choose the next input, previous input or Add action; preserve an explicit user move |

Installed Vue is 3.5.44. H44 was reached through the editor draft's published
version link. These sources do not grant settings, filesystem or provider authority.

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Stable weak row keys plus component useId | Preserves surviving DOM/input identity; no saved UI metadata or global row registry | Two focused components and a small identity factory | Implement |
| Array-position keys and IDs | Minimal code | Reuses another row's component after removal; identity follows position | Replace |
| Keys from editable paths/user names | Readable | Blank/duplicate values collide; editing remounts inputs | Reject |
| Add IDs to saved row objects | Easy persistence | Mixes UI identity with canonical settings data and schema | Reject |
| One generic configurable row component | Shared markup | Adds a configuration/model API for two domain-specific rows | Prefer two small explicit components |

Final stack: existing native controls/form groups, nine static label pairs,
component-owned useId, a view-scoped WeakMap of symbolic render keys, explicit
named models and the existing settings save owner. The WeakMap has no strong row
registry, timers or global singleton. This is a lifetime design, not a measured
RSS improvement. A small removal helper reuses existing command-focus ownership
through Vue rendering, retiring its temporary listener afterward. The exact
next/previous/Add policy is a project choice, not prescribed by WCAG. See [design](STORAGE_LABELS_DESIGN.md) and
[outcome](STORAGE_LABELS_OUTCOME.md).
