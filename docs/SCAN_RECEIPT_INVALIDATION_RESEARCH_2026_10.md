# Scan receipt invalidation official research

Consulted October 12, 2026 through connected MCP search, official navigation and
fresh opens of previously verified primary links. The separate
[design](SCAN_RECEIPT_INVALIDATION_DESIGN.md) owns project choices and
[outcome](SCAN_RECEIPT_INVALIDATION_OUTCOME.md) owns executed evidence.

| Official source | Status/applicability | Decision |
| --- | --- | --- |
| [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | Server reference; Read Committed statement snapshots can change between commands. | Capture the pre-walk receipt revision and recheck it on the publishing client rather than trusting an old query. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Server reference; cooperating writers and consistent row-lock order. | Scan run/lease/root, then candidate and receipt; required events and negative rows share the catalogue transaction. |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) | Informative security guidance; bind significant data and verify at execution. | Opaque pre-walk capability, exact revision/path/private root and final original-acquisition checks. Negative evidence grants no new consent or provider replay. |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html) | Official v24.21.0 reference; installed v24.18.1 supports the used APIs. Filesystem checks and later work can race. | Require actual ENOENT and unchanged contained ancestors, repeat after events, and retain current-byte Wanted verification. Other I/O errors refuse. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Working Draft September 1, 2026; measurement guidance, not completed UI conformance. | Keep timing observations separate from SQL lease authority. No speedup, accessibility certification or positive availability claim. |

Revision-bound negative observations are a project inference, not a standards
mandate. SQL cannot atomically commit a filesystem observation or fence unrelated
external file writers. Current bytes remain authoritative. Windows drive-qualified
and process-drive-rooted spellings must both be selected, then checked with actual
host path semantics; a case-folded SQL prefix is only a lookup superset.
