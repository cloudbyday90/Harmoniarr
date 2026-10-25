# Configured-path redaction research

Reviewed October 25, 2026 through MCP web search/retrieval. These recommendations
are application design decisions informed by the sources, not certification.

1. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
   identifies file paths as potentially sensitive investigation data. It allows
   sanitization before display, recommends reusable tested handlers, CR/LF
   sanitization and verification of unwanted side effects/resource exhaustion.
   Apply shared server-side minimization and preserve useful structured context.
2. [Node.js path documentation](https://github.com/nodejs/node/blob/main/doc/api/path.md)
   explains that default path behavior depends on the host OS and documents
   explicit Windows/POSIX handling. Our text matcher therefore classifies configured
   roots explicitly; it does not use the host's default path resolver or equate
   textual matching with filesystem authorization.
3. [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   explains exposing status changes to assistive technology without taking focus.
   Preserve existing Recovery status/focus behavior and truthful error metadata;
   this backend hardening does not establish screen-reader or device acceptance.

The design document records alternatives, pros/cons, limits and the final stack.
Prefer structured errors over ever broader free-text inference for the next step.
