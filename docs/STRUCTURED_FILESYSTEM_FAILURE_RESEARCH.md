# Structured filesystem failure research

Official sources discovered/retrieved with MCP on October 25, 2026. These are
application recommendations, not claims of standards certification.

- [Node.js 24 errors](https://r2.nodejs.org/docs/latest-v24.x/api/errors.html)
  recommends identifying errors by code because messages can change between
  releases. System errors have separate path/destination properties; inspecting
  chained causes can reveal underlying details. Use a finite code map, producer
  context and fresh safe text rather than native-message parsing or cause copying.
- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet)
  recommends keeping unexpected internal details out of responses while retaining
  investigation context. Our selected producers retain codes and stable record
  IDs alongside explicit path fields in existing protected persistence.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  treats file paths as potentially sensitive and recommends consistent event
  classification and sanitization. Shared key-based redaction complements safe
  producer text; no arbitrary-secret detection guarantee follows from this change.
- [W3C WCAG 2.2 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
  calls for known correction suggestions for input errors where safe. Filesystem
  failures are not necessarily input errors, but fixed permission/space/availability
  guidance follows that usability principle without exposing private filenames.
- [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains presenting status changes without taking focus. Preserve the existing
  status/focus flow; backend tests cannot certify real assistive-device behavior.

See the separate design document for alternatives, tradeoffs, final stack and
coverage limits. Extend producer coverage incrementally rather than broadening
slash matching or creating an unbounded collection of retired private roots.
