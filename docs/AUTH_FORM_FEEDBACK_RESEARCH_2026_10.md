# Authentication feedback research

Consulted October 21, 2026 using MCP search, primary-page opens and official
navigation. Installed Vue is 3.5.44, Router 5.2.0 and Playwright 1.64.1; no upgrade
is needed for this fix.

| Source and status | Applicable recommendation | Implementation owner |
| --- | --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation, December 12, 2024 | Error identification, status messages and accessible authentication apply to entry forms. | Persistent feedback and linked local validation; retain native/password-manager input behavior. |
| [ARIA21](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21), informative technique updated April 27, 2026 | Set aria-invalid after validation and associate the correcting description. Techniques are examples, not mandatory implementations. | Confirmation input and current match hint. |
| [WAI form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/?trk=public_post_comment-text), informative tutorial | Explain errors and provide a correction path; first invalid input can receive focus after submit. | Synchronous local validation with post-flush focus ownership; async global errors retain current focus. |
| [Vue accessibility](https://vuejs.org/guide/best-practices/accessibility.html), framework guidance | Keep labels and instructions programmatically connected and available outside placeholders. | Existing labels/native controls plus shared feedback components. |
| [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), informative security guidance | Generic credential errors reduce account disclosure; allow paste/password managers. | Preserve server decisions, escape rendered text, add no credential-specific inference, logs or retry. |
| [ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19), informative technique | Persistent live containers can receive changing error content. | Keep status/alert owners mounted before inserting feedback; flush cleared errors on retry. |

The one-pending-action policy is a project implementation decision, not a WCAG
requirement. It prevents local/Plex feedback and request owners competing; it is
not server rate limiting, idempotency or replacement authorization.

## Options and tradeoffs

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Add role=alert to each existing paragraph | Small patch | Misses pending feedback, mismatch association, stale error and request competition | Insufficient |
| Shared feedback component plus focused composables | Consistent entry forms, explicit ownership, cheap focused tests | Three views must adopt the shared contract | Implement |
| Global form/validation library | Wider schema/form features | Dependency and migration cost exceeds this small problem | Defer |
| Focus every async error | Visibly draws attention | Can steal focus and invent which credential is wrong | Reject |

## Final recommendation stack

Native HTML labels/required/type/autocomplete, existing auth API/session owners,
small ESM submission/confirmation composables, persistent Vue status/alert
feedback, native browser/HTTP validation and separately recorded manual AT/device
acceptance. Extend the existing standards skill with this decision workflow;
another overlapping accessibility skill would make discovery less precise.
