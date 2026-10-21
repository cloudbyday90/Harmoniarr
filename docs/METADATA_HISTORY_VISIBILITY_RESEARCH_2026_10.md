# Metadata focus visibility: official practices and choices

Consulted October 21, 2026 through MCP search, then opened the discovered official
pages. This is guidance available on that date, not a prediction of future
revisions or a platform-wide conformance claim.

## Applicable sources

| Source and status | Applicable behavior and owner |
| --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation (December 12, 2024), normative criteria 2.4.3/2.4.11 | Meaningful focus order and focus not wholly obscured by authored content. Browser qualification checks the actual history control and shell. |
| [Focus Not Obscured understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), informative explanation | Fixed overlays can hide focus. Test the mobile bottom navigation, not just viewport bounds. |
| [W3C technique C43](https://www.w3.org/WAI/WCAG22/Techniques/css/C43), informative sufficient technique | Scroll clearance can accommodate fixed content. The technique is an example, not a requirement to adopt its exact CSS. |
| [WHATWG HTML focus algorithm](https://html.spec.whatwg.org/multipage/interaction.html), living normative standard | Native focus normally requests centering; preventScroll separates restoration from the chosen reveal policy. |
| [CSSOM View](https://drafts.csswg.org/cssom-view-1/), CSSWG editor's draft | Nearest block/inline alignment and instant behavior provide bounded native scrolling, without a delayed animation after interaction ownership expires. Draft status does not prove browser support. |
| [CSS Scroll Snap Level 1](https://www.w3.org/TR/css-scroll-snap-1/), Candidate Recommendation; [current editor's draft](https://drafts.csswg.org/css-scroll-snap/) | Scroll margins adjust a target's scroll-into-view area even without snapping. The panel can reserve bottom clearance locally. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), security guidance | Every request needs its owning permission check. Focus ownership is a presentation concern; native command tests still prove fresh server authority and CSRF refusal. |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), Internet Standard, section 9.2.1 | Pagination remains a GET with read-only requested semantics. Revealing the button submits no mutation, retry command or provider operation. |

The implementation choice is a project inference from these contracts. Full
visibility with spacing goes beyond the minimum criterion's partial visibility.
Native Chromium proof establishes this checkout's behavior, not every browser or
assistive technology. Installed framework/runtime versions are recorded with
the validation outcome rather than inferred from external documentation.

## Options, benefits and costs

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Keep preventScroll alone | Preserves position | Reproduced focused control remains off-screen | Reject |
| Restore with default focus scrolling | Small change, native behavior | Centers even an already-visible target; retained-focus branch still needs policy | Reject |
| Native instant nearest reveal after owned successful append, scoped target margins | Small module, no custom visibility geometry; keeps visible targets stationary and accounts for mobile chrome | Requires native browser qualification; follows the button past newly appended rows | Recommend |
| Custom intersection/overlay geometry or shared global scroll service | Can model arbitrary overlays | Extra observers, lifecycle and shared-view regression scope for a local defect | Defer unless actual unsupported geometry is reproduced |

Recommended stack: WCAG's observable focus outcome; WHATWG native focus;
CSSWG nearest scrolling and target margins; existing Vue DOM-flush and generation
guards; existing native keyboard/HTTP fixtures; frozen-artifact fast validation
and preserved-state Docker qualification. Retain OWASP request authorization and
IETF safe-read semantics at the server boundary. No dependency or framework change is
needed. The existing standards skill will capture this bounded workflow instead
of adding a duplicate broad standards skill. See the
[design](METADATA_HISTORY_VISIBILITY_DESIGN.md) and eventual
[outcome](METADATA_HISTORY_VISIBILITY_OUTCOME.md) for implementation and evidence.
