# Provider callback error research

Consulted October 28, 2026 through Search/GitHub MCP. URLs were discovered and
opened through MCP. The repository uses ESM, Node 24.22.1, npm 12.0.2 and Express
5.3.0. Initial GitHub MCP search found no open PRs.

| Official source and status | Applicable practice | Application decision |
| --- | --- | --- |
| [OWASP Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet), informative security guidance | Unexpected failures should not disclose implementation diagnostics. | Unknown callback errors use a fixed provider fallback, including factory-owned errors with unreviewed codes. Never serialize message, details, cause or arbitrary code into the redirect. |
| [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700), BCP 240, January 2025 | Preserve callback CSRF/code binding and avoid credential leakage through redirects, referrers and history. | Keep the fixed relative destination, distinct provider callbacks, PKCE/state/browser binding and existing no-referrer/no-store headers. Code selection is an output boundary, not callback authorization. |
| [W3C Referrer Policy](https://www.w3.org/TR/referrer-policy/), Candidate Recommendation, January 26, 2017 | Referrer policy controls outbound referrer disclosure; it does not prevent every URL leak. | Assert that callback redirects retain no-referrer. Do not claim that this erases the original callback from history or server/proxy logs. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Minimize unnecessary personal-data disclosure. | Apply this guidance to redirect query values with finite provider-specific catalogs. This is a project design inference, not general standards certification. |

## Options and recommendation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Encode arbitrary error.code | Preserves every diagnostic | Encoding still discloses arbitrary values in URLs and redirect bodies | Replace |
| Accept any string with a provider prefix | Small policy | Private text can share the prefix; new producer codes silently become public | Reject |
| Always use one generic failure code | Smallest public vocabulary | Loses recognized state, administrator-authority and not-claimed distinctions | Do not use for known outcomes |
| Explicit provider catalogs plus fixed fallback | Preserves useful reviewed outcomes and bounds unexpected output | New callback outcomes require deliberate catalog review; unknown diagnoses are less specific publicly | Implement |

Recommended stack: existing callback owner and public API-error descriptor,
then a pure ESM provider-specific code selector, then the existing URLSearchParams
and fixed settings redirect. A primitive string must match an exact catalog
entry. Captured public codes precede later mutation; raw provider transport codes
may match only the same finite vocabulary. Neither prefixes nor API-error
provenance alone make arbitrary code public. No new persistence, service
deployment, dependencies, retries or diagnostic logging is needed.

The catalog includes callback-reachable state/authority/link changes, required
OAuth credentials, token exchange/invalid response, Plex PIN read/profile and
bounded HTTP failures. Start-only, other-operation and cross-provider errors use
the provider fallback. Existing callback-input validation remains with its owner.

See the separate [design](PROVIDER_CALLBACK_ERRORS_DESIGN.md) and
[outcome](PROVIDER_CALLBACK_ERRORS_OUTCOME.md).
