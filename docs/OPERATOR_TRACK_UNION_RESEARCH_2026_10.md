# Two-owner delivery: official research

Consulted October 12, 2026 via GitHub MCP and the MCP search service. Search and
official navigation identified these URLs, which were opened for review. This is
guidance available on that date, not a prediction of end-of-month changes.

Observed local runtime: Node 24.18.1, npm 12.0.2, pg 8.23.0 and pg-pool 3.14.0;
the owned native fixture reported PostgreSQL 18.3 and ffprobe 8.0.1. These are
observed versions, not claims that each is the latest release.

| Official source / status | Applicable guidance | Project inference |
| --- | --- | --- |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), living informative guidance | Least privilege, deny by default and resource-specific authorization | A shared download does not grant delivery into every user's folder |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), living informative guidance | Server-owned transaction data and final authorization | Capture owner/request/scope participants and compare them before delayed dispatch, mutation and receipt publication |
| [OWASP Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html), living informative guidance | Validate business meaning and transitions | Whole-candidate status is not per-person fulfillment; don't drop an incompatible participant |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), versioned documentation | Locks protect cooperating transactional work | Use existing admission/transaction owners; do not claim SQL makes filesystem copying atomic |
| [node-postgres transactions](https://node-postgres.com/features/transactions), library documentation | One checked-out client owns transaction statements | Forward the owned queryable through participant, consent, settings and receipt reads/writes |
| [Picard 3.0 tag mapping](https://picard-docs.musicbrainz.org/en/latest/appendices/tag_mapping.html), format documentation | Recording, release and release-track tags differ by format | Preserve actual release/recording/position/duration probe checks; no acoustic identity claim |
| [WCAG 2.2](https://www.w3.org/TR/wcag/), December 12, 2024 W3C Recommendation | Understandable, programmatically available status | Keep queued, delivered and needs-review outcomes distinct; rendered accessibility needs separate browser evidence |

## Recommendation stack

Current owner intent/catalog → complete typed participants → exact union files →
guarded provider manifest → distinct current recipient destinations → fresh
media/path/quality checks → atomic separate receipts → owner-specific current
Wanted outcome.

Benefits: bounded shared acquisition and no implicit cross-user delivery.
Costs: strict file metadata, extra participant/root reads and file-byte checks,
plus conservative retry support. Recommend the bounded two-owner slice, followed
by explicit partial-delivery recovery before broader unions. W3C, OWASP, database
ownership and domain identity address different boundaries; the standards skill
should map each practice to its actual owner and evidence.
