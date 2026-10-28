# HTTP error boundary research

Consulted October 28, 2026 through Search/GitHub MCP. URLs were discovered through
search and opened, not inferred. Local runtime is Node 24.22.1, npm 12.0.2 and
Express 5.3.0. GitHub initially reports no open repository PRs.

| Official source/status | Applicable guidance | Project decision |
| --- | --- | --- |
| [OWASP Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet), informative security guidance | Unexpected failures should return generic responses rather than implementation details. | Centralize the global error projection. No raw error, stack, SQL, path, cause or custom serialization crosses this boundary. Raw diagnostic logging remains a separate policy. |
| [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), Proposed Standard, July 2023 | Problem details describe the HTTP interface, with care against disclosing implementation internals. | Apply the disclosure principle while retaining the existing JSON envelope. This does not implement or claim conformance to application/problem+json. |
| [Express 5 error handling](https://expressjs.com/en/5x/guide/error-handling/), framework documentation | Error middleware has four arguments and belongs after routes. Already-started responses need delegation rather than another response write. | Keep terminal middleware ordering and delegate a bounded error after headers are sent. Never reflect arbitrary error headers or use untrusted status fields. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Minimize unnecessary disclosure, including sensitive data. | Copy only the explicit public status/code/message descriptor; omit arbitrary error properties, bodies and credentials. This is an application of informative guidance, not accessibility or privacy certification. |

## Alternatives and recommendation stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Preserve every error's fields | Smallest code change | Native and third-party errors can disclose messages/codes or choose invalid HTTP statuses | Replace |
| Trust any 4xx status or expose=true | Easy compatibility | Arbitrary native objects can impersonate intentional errors | Reject |
| Make every failure a generic 500 | Strong default minimization | Loses validation, permission, conflict, dependency and retry guidance | Reject |
| Explicit factory-owned immutable descriptor; generic fallback | Keeps intentional contracts and refuses structural impersonation | Legacy constructors must migrate; callers of the public factory still own safe wording | Implement |
| RFC 9457 response migration now | Standardized new format | Changes existing client contracts without being needed for this fix | Defer |

Recommended stack: the existing API-error factory captures a weakly held public
descriptor; a narrow ESM response projector applies known parser/database adapters
and a generic fallback; terminal Express middleware sends only that projection.
Migrate existing intentional constructors without changing their policy. Keep
native error objects, authorization, domain transactions, commands and stored
operation diagnostics with their current owners.

See the separate [design](HTTP_ERROR_DESIGN.md) and [outcome](HTTP_ERROR_OUTCOME.md).
