# Verified track requirements: official research

Consulted October 12, 2026 through connected Search MCP. Search identified OWASP
and MusicBrainz pages; official Recording navigation successfully opened Track
after a direct open error. Official navigation supplied OWASP's canonical
transaction authorization URL. Previously MCP-verified W3C, PostgreSQL and driver
pages were refreshed. Consultation does not establish future October updates.

| Primary source / authority | Applicable practice | Application and limits |
| --- | --- | --- |
| [MusicBrainz Track](https://musicbrainz.org/doc/Track) and [Recording](https://musicbrainz.org/doc/Recording), official domain documentation | A track represents a recording on a particular medium; one recording can occur on multiple tracks | Recording identity alone is insufficient for edition/position membership. Do not pretend a catalog without track MBIDs can verify them. |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), informative security guidance | Verify significant transaction data server-side and prevent client tampering | Recompute exact track requirements from current catalog and saved owner input at publication and delayed acquisition boundaries. |
| [OWASP Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html), informative guidance | Recompute security-relevant values from trusted data | A remap flag or candidate score cannot authorize broader acquisition. Conservative refusal is a project decision, not a music policy mandated by OWASP. |
| [PostgreSQL 18 locks](https://www.postgresql.org/docs/18/explicit-locking.html), vendor documentation | Consistent lock ordering and cooperative transaction advisory locks | Retain source admission and capture/recheck catalog rows; enroll supported standalone writers. Raw SQL does not automatically participate. |
| [node-postgres transactions](https://node-postgres.com/features/transactions), driver documentation | Transaction statements share one client | Keep catalog, current requirement and writes on the owning transaction queryable. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation December 12, 2024 | Explain state in text and provide status feedback without stealing focus | Expose a bounded review/verification reason; future rendered status behavior needs browser evidence. Backend changes do not certify WCAG conformance. |

These mappings are engineering inferences. Prefer current-catalog proof and typed
owner scope with explicit downstream refusal over title-based partial acquisition.
Its cost is deferred subset automation and catalog-read overhead. Exact file
selection, tag/media verification and owner-specific fulfillment need their own
positive end-to-end evidence before enabling partial acquisition.
