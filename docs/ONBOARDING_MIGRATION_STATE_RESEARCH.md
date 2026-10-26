# Onboarding migration state and refresh research

Consulted October 26, 2026. Official URLs were discovered and opened through MCP
search. Applies to the installed Vue 3.5.44, Node 24.22.1 and PostgreSQL 18.6
baseline. See separate [design](ONBOARDING_MIGRATION_STATE_DESIGN.md) and
[outcome](ONBOARDING_MIGRATION_STATE_OUTCOME.md).

| Official source and status | Application decision |
| --- | --- |
| [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block), informative explanation of SC 4.1.3 | Keep one stable status region for loading, refresh completion, unavailable checks and transport failure. Feedback must not move focus. Browser DOM checks do not prove actual speech or full WCAG conformance. |
| [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/), W3C Recommendation | Use polite atomic status feedback outside the results' busy region. Convey pending Refresh through aria-disabled while guarding activation in code. Link the control to the results with aria-controls; preserve the focusable native button. |
| [Vue Composition API helpers](https://vuejs.org/api/composition-api-helpers.html), official framework documentation | Generate the results identifier with useId during setup. The API provides application-unique IDs for accessibility relationships; do not generate them inside computed state. |
| [OWASP error handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet), informative guidance | Return bounded generic explanations instead of raw exceptions. The migration-step projector ignores rejection text and filenames; the fetch workflow uses a fixed failure message. |

An unsuccessful observation does not establish either zero or one pending
migration. That is an application data-model conclusion, not a numeric rule from
these standards. Retained successful data must be explicitly described as the last
successful checklist after a refresh failure. Do not infer current readiness from
that retained snapshot or from a successful HTTP delivery of partial diagnostics.

| Recommendation | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Explicit unavailable database step, counted as an open issue | Honest distinction from known pending/current state; no false all-ready summary | Extends the step status vocabulary | Implement |
| Stable status region, separate busy results and guarded Refresh | Announces progress/results without replacing the invoking control | Manual assistive-technology checks remain necessary | Implement |
| One active read per composable with retained successful data | Avoids overlapping refresh results and keeps useful context | Retained data needs a clear stale-result explanation | Implement |
| Synthetic pending migration or assumed current state on failure | Small fallback | Misstates database knowledge or readiness | Reject |
| Disable/remove the button during refresh or create a new UI service | Simple presentation or separate deployment lifetime | Disrupts interaction or adds unnecessary ownership | Reject for this scope |

Recommended stack: read-only migration observation → pure unavailable/current/
pending projector → summary issue accounting → existing fetch composable with one
active request → stable, bounded panel feedback and retained focus. Keep fatal
startup validation and the deployment unchanged.
