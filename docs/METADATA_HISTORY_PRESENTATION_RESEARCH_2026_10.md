# Metadata history presentation research and recommendations

Consulted 2026-10-21 through MCP search, primary-source reads and official links.

| Source / status | Application |
| --- | --- |
| [W3C H48](https://www.w3.org/WAI/WCAG21/Techniques/html/H48), informative technique updated January 12, 2026 | Preserve the event list; express each entry's name/value relationships with dt/dd. Techniques are examples, not mandatory implementation recipes. |
| [WHATWG grouping content](https://html.spec.whatwg.org/multipage/grouping-content.html), normative living standard | Keep valid list and description-list structure while styling narrow cards. |
| [WHATWG time](https://html.spec.whatwg.org/multipage/text-level-semantics.html), normative living standard | Separate human-readable time from the machine-readable instant in datetime. Missing or invalid instants remain ordinary fallback text. |
| [ECMA-402, 13th edition, June 2026](https://402.ecma-international.org/13.0/), published standard | Use Intl.DateTimeFormat, default host locale/timezone and a visible shortOffset. Test explicit locale/timezone settings; do not treat the current 2027 editor draft as the published 2026 edition. |
| [Vue built-in directives](https://vuejs.org/api/built-in-directives), framework documentation | Render display values as text; do not compose provider-supplied HTML with v-html. |

Stacked details, absolute second precision, explicit timezone offsets, supported
ISO input bounds and caching one formatter are project decisions informed by
these sources. HTML time semantics do not mandate a locale, and description-list
DOM checks do not prove every assistive technology's reading behavior.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Insert separators between existing spans | Small change | Weak label/value structure; raw ISO values remain hard to scan | Reject |
| Fixed UTC text everywhere | Stable across operators | Ignores the browser's local display conventions | Keep machine value UTC; localize visible time |
| Relative times only | Compact | Ages without refresh and obscures exact historical instants | Reject for these details |
| Small entry/time components plus native Intl | Clear ownership, semantic relationships, local timezone and no new dependency | More component wiring; localized text varies by environment | Implement |
| Global date library and presentation migration | Broad reuse | Larger dependency and unrelated regression scope | Defer |

Recommendation stack: existing authenticated history reads and current-page
ownership; small entry/time components; supported explicit-zone instants;
normalized datetime plus localized absolute label/offset; escaped text;
stacked token-based details; focused/native/visual checks; exact final artifacts
and preserved Docker readiness. MCP returned zero open PRs; there was no random
candidate to implement, merge, rebase or close.
