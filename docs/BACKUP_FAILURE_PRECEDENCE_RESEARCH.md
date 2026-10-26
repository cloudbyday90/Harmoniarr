# Backup failure precedence research

Official sources discovered/retrieved through MCP on October 26, 2026.

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends testing logging failures, avoiding unwanted application effects and
  sanitizing/excluding sensitive data. Apply this to the secondary journal-failure
  diagnostic: finite categories, a validated reference and no raw errors/paths/SQL.
  This is operational hardening, not a general security audit.
- [Node.js error documentation](https://nodejs.org/download/release/v24.20.0/docs/api/errors.html)
  explains error chaining and recursive inspection of `cause`. Wrapping is useful
  when changing the error contract, but this project needs exact primary identity
  and null preservation. Keep secondary details in a separate minimized diagnostic.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains accessible status feedback without changing focus. Preserve failure,
  deferred and completed meanings; unavailable failure recording is not a successful
  persisted outcome. No new UI or manual assistive-device conformance claim.
- [Vite releases](https://github.com/vitejs/vite/releases) document 8.3.5 build,
  import-map, development-server and dependency fixes.
- [Vue Router releases](https://github.com/vuejs/router/releases) document 5.4.0,
  including a breaking change to experimental query normalization. The application
  uses stable router imports; that applicability assessment is a source-review
  inference, followed by build/client and actual browser validation.
- [PR #56](https://github.com/cloudbyday90/Harmoniarr/pull/56) supplies the exact
  two-file dependency patch. GitHub MCP identified base/head and patch; the local
  selection used `node:crypto.randomInt` over PRs 55 and 56. No GitHub merge is used.
- The [body-parser maintainer advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
  identifies a default-decompression denial of service fixed in 2.4.0. The installed
  2.3.0 parser and production factory match the affected configuration. See the
  separate [parser design](COMPRESSED_JSON_SECURITY_DESIGN.md) for the targeted
  update, primary fix reference, reproduced child crash and regression approach.

OWASP and WCAG Understanding pages provide guidance; the precedence/recovery
contract and recommendation stack are project decisions. See the
[design](BACKUP_FAILURE_PRECEDENCE_DESIGN.md) for alternatives and scope.
