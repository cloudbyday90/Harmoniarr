# Backup journal failure research

Official sources discovered/retrieved through MCP on October 25, 2026. Runtime
baseline is Node 24.22.1/PostgreSQL 18.6, verified again by packaged checks.

- [Node.js 24 error documentation](https://r2.nodejs.org/docs/latest-v24.x/api/errors.html)
  describes codes as more stable identifiers than messages. It also documents
  cause inspection exposing underlying errors. Use the finite shared code catalog
  and fixed text without copying native prose or cause chains into journal fields.
- [Node.js 24 filesystem documentation](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html)
  documents replacement of an existing destination by rename. The current
  promotion service verifies before calling rename. By source inspection, those
  separate calls do not establish an atomic no-overwrite guarantee; qualify an
  exclusive publication protocol and concurrent recovery in a separate follow-up.
  This is an inferred boundary, not a reproduced concurrent overwrite incident.
- [PostgreSQL 18 UPDATE](https://www.postgresql.org/docs/18/sql-update.html)
  documents that columns omitted from an update retain their values. A dedicated
  error-only statement preserves the current journal phase and completion metadata
  without guessing them from an older service object.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  treats file paths as potentially sensitive investigation data and recommends
  consistent classification/sanitization. Retain owned path columns and IDs;
  replace raw vendor text and use shared path-key minimization for projections.
- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet)
  recommends withholding unexpected internal details from responses. This increment
  hardens journal persistence; original thrown errors retain their existing caller
  contract and require separate review at outward run/audit/HTTP boundaries.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains conveying status without taking focus. Keep confirmation, deferred
  recovery and completed outcomes truthful. This backend-only change neither adds
  a status UI nor establishes real screen-reader/device acceptance.

Node/PostgreSQL pages are vendor contracts; OWASP and WCAG Understanding pages
are guidance. The journal design and evidence-retention rules are project choices.
See the design document for pros/cons and the final recommendation stack.
