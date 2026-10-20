# Canonical acquisition research and recommendation stack

Consulted October 20, 2026. GitHub MCP discovered repository resource URLs and
the open PR collection; MCP search discovered/opened the official pages below.

| Source / authority | Applied boundary |
| --- | --- |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Recheck authenticated actor, own target scope and current target state on each actual command; a browser permission flag grants no authority. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), IETF standard | POST is not inherently idempotent. Preserve the existing durable key/operation contract and prove replay creates no second provider command. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html?trk=article-ssr-frontend-pulse_little-text-block), vendor documentation | Reuse current short transaction/lease owners; row locks protect scoped transitions, not browser authorization or external transfer completion. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), Recommendation | By design inference, retain provenance through actor, recipient, command, run, receipt and canonical bytes. This does not establish accessibility conformance. |
| [W3C WCAG 2.2 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/), informative companion guidance discovered through official navigation | Use a named native link in the event context, preserve focusability and distinguish focused browser evidence from full accessibility conformance. |

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Seed selected status and ready planning | Small transport fixture | Cannot establish canonical command/eligibility ownership | Replace in audio lane |
| Invoke domain services directly | Exercises policy cheaply | Omits actual sessions, CSRF, routes and durable command replay | Keep focused tests; insufficient here |
| Real authenticated commands and configured worker | Preserves ownership and current eligibility through native publication | More setup and precise refusal assertions | Recommend |
| Full browser/discovery/live provider replay | Broader journey | Requires more surfaces, accounts/network and runtime | Separate follow-up |

Final stack: controlled pending search results; actual authenticated canonical
HTTP commands; current actor/recipient resolution and durable replay; canonical
queue/worker/planner; real native provider and receipt snapshot; bounded export;
actual inspection/apply/catalogue/audit. Keep the native case opt-in and reuse
fast capability controls. No new framework, dependency or parallel job system.

The canonical prototype exposed a rejected queued Activity type. Extend the
existing type admission, database CHECK, client presentation and rendered link
policy, preserving queued-versus-provider-accepted meaning. See the separate
[Activity design](QUEUED_DOWNLOAD_ACTIVITY_DESIGN.md). The new migration retains
all old allowed values; actual unknown-type refusal and source/snapshot anchor
comparison verify that the guard remains enforced.

Official navigation opened the published [Focus Visible explanation](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible).
The published link-purpose page returned HTTP 429; the discovered
[official editor explanation](https://w3c.github.io/wcag/understanding/link-purpose-in-context.html)
was available and is explicitly an unpublished, informative draft. The browser
check establishes focus ownership and a visible named link, not a complete
visual-focus, assistive-technology or WCAG conformance assessment.
