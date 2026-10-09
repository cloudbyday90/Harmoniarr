# Official practices by boundary

Consulted October 3, 2026. URLs were discovered through web search, official
navigation, and GitHub MCP and opened for review. Revalidate changing guidance
when applying this reference. Read only the rows relevant to the requested work.
This is an applicability map, not a compliance catalog.
Authorization, business-logic, PostgreSQL transaction and status-message guidance
was freshly discovered/opened October 8 for scoped recovery. Other rows retain
their earlier consultation date; consultation is not publication.

## Browser controls and feedback

| Source | Status | Decision it informs |
| --- | --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) | Normative W3C Recommendations | Consult the applicable criterion/role/state for precise requirements; busy state can defer updates and status implies polite/atomic semantics. These URLs were independently opened during the skill trial. |
| [WHATWG HTML form elements](https://html.spec.whatwg.org/multipage/form-elements.html) | Living specification | Specify button types: ordinary commands use `button`; intentional form confirmation can use `submit` with its owning submit handler. Avoid accidental submission or custom keyboard emulation. |
| [WHATWG dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element) and [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Normative living specification and informative APG; refreshed October 3 for Add to library | Native modal behavior makes outside content inert. Select where pending feedback remains exposed: inside an open modal or outside after closure. Deliberate initial/return focus and Tab/Escape behavior need browser evidence; timing is a product choice. |
| [W3C keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) and [focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) | Informative explanation of WCAG criteria | Test actual keyboard activation and the rendered focus indicator. |
| [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Informative explanation of WCAG 2.2 AA | Test controls/focus destinations in the actual scrolling shell, including sticky chrome and narrow layouts. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) and [ARIA22 technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22) | Informative explanation/optional sufficient technique; status explanation refreshed October 8 | Establish a status container before updates; explicit atomic semantics are useful. Require truthful current work evidence; pending matches alone do not establish queued/running work. A DOM role alone does not prove announcement. |
| [W3C button pattern, official mirror](https://w3c.github.io/wai-website/ARIA/apg/patterns/button/) | Informative APG | Enter/Space activation, accessible names/descriptions, and action-appropriate focus. The mirror was readable when the canonical host rate-limited. |
| [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Informative explanation of WCAG 2.2 AA | The criterion uses 24 CSS pixels with exceptions. Harmoniarr's 44-pixel mobile target is a stronger local convention, not the AA requirement. |
| [Vue accessibility](https://vuejs.org/guide/best-practices/accessibility) | Framework guidance | Use semantic structure and deliberate focus across rendered route/state changes. |
| [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) | Testing guidance | Combine automation with manual/inclusive checks; do not infer full conformance from an automated pass. |

WCAG Understanding pages, techniques, and APG are guidance, not the normative
standard themselves. Follow their official links to the applicable normative
criterion/specification when a precise conformance interpretation is needed.
Do not require every documented technique or attach a full conformance claim to
a small feature's passing tests.

## HTTP, authority, and durable work

| Source | Status | Decision it informs |
| --- | --- | --- |
| [IETF RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Standards-track RFC | Separate reads from commands; do not assume a non-idempotent method can be retried safely. Application durable replay and response shapes are explicit project contracts. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [authorization patterns](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html) | Security practice guidance; refreshed October 8 | Authorize the selected object/recipient using current server-side relationship authority; UI visibility or an old delayed intent is insufficient. |
| [OWASP business logic security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Security practice guidance; consulted October 8 | Keep workflow state server-owned and coordinate authoritative check/write decisions. A database transaction does not make provider work atomic; preserve uncertain dispatch and conditionally retire known-undispatched refused intent. |
| [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Security practice guidance | Preserve session-bound mutation protections; a new UI command does not justify bypassing CSRF. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned database guidance; refreshed October 8 | Row/advisory locks, short transactions, fresh reads after locks and consistent acquisition order support transaction-owned concurrency. All relevant writers must participate; avoid provider/media IO while holding locks. |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html) | Versioned database guidance | Queue-oriented skipping has a different consistency purpose from an authoritative command read. |
| [Node 24 ESM](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html) | Versioned runtime guidance | Keep explicit imports/exports and module-compatible file specifiers; third-party examples may use a different module format. |

These sources do not require a new queue, database isolation migration, UI
framework, idempotency-header protocol, or security-scanner installation. Choose
the narrow existing boundary that satisfies the requested behavior. General
security review and dependency hygiene complement these practices but do not
constitute a security certification.
