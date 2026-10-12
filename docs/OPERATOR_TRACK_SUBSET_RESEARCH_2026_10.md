# Single-track acquisition: official research

Consulted October 12, 2026 through GitHub MCP and the MCP search service. Search
results and official navigation supplied the URLs below; pages were opened for
review. This establishes guidance available on that date, not future end-of-month
publication status. Project decisions are inferences from these sources and the
current implementation, not standards conformance claims.

Observed local runtime: Node 24.18.1, npm 12.0.2, pg 8.23.0 and pg-pool 3.14.0.
The acknowledged network-disabled media fixture uses ffprobe 8.0.1. These are
local observations, not claims that each is the newest available release.

| Primary source / status | Applicable practice | Project decision |
| --- | --- | --- |
| [MusicBrainz Track](https://musicbrainz.org/doc/Track), domain documentation | Track identity belongs to a release/medium occurrence | Match catalog release, recording and positions; do not equate a recording with every appearance |
| [MusicBrainz Recording](https://musicbrainz.org/doc/Recording), domain documentation | A recording may occur on many tracks | Require edition/position evidence beyond recording identity |
| [Picard 3.0 tag mapping](https://picard-docs.musicbrainz.org/en/latest/appendices/tag_mapping.html), informative format documentation | Vorbis recording ID uses MUSICBRAINZ_TRACKID; release ID uses MUSICBRAINZ_ALBUMID; release-track ID is a separate tag | Check the actual probe's recording/release tags and positions; do not mislabel a recording tag as a release-track MBID |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), living informative guidance | Server-owned significant transaction data, sequential steps and final authorization | Compare persisted scope and exact file manifest at selection/preparation/provider admission; recheck before mutations |
| [OWASP Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html), living informative guidance | Validate business meaning and protected transitions | Folder status alone cannot satisfy a person's selected-track requirement; changed consent must refuse |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), official versioned documentation | Transaction advisory locks require cooperating owners and expire with the transaction | Retain metadata source admission and current catalog checks; do not claim SQL makes filesystem work atomic |
| [node-postgres transactions](https://node-postgres.com/features/transactions), official library documentation | Transaction statements use one checked-out client | Forward the owning queryable to nested scope/catalog/consent/file reads and receipt writes |
| [WCAG 2.2](https://www.w3.org/TR/wcag/), W3C Recommendation dated December 12, 2024 | Programmatically available status, meaningful labels and understandable errors | Preserve distinct queued/import-pending/fulfilled/review states; rendered focus/live-region work needs separate browser evidence |

## Final recommendation stack

1. Saved positive owner intent and verified current catalog occurrence.
2. Complete shared requirements; refuse incompatible or unsupported scope.
3. Exact numbered file binding, with contradictory raw paths refused.
4. Filtered preview and provider manifest; current-state checks at protected steps.
5. Fresh actual media tags/streams/duration and existing quality/path verification.
6. Verified destination bytes and atomic owner/request/scope receipt publication.
7. Owner-specific fulfillment and current-file Wanted reconciliation.

Benefits are bounded acquisition, no implicit sibling permission, inspectable
receipt evidence and reuse of existing workers. Costs are strict metadata/name
requirements, extra database/media/file reads, conservative recovery limitations
and deliberately limited subset support. Recommend this bounded stack now;
design multi-track/disc unions and explicit per-owner delivery next. Acoustic
identification and indexed receipt invalidation are separate enhancements.

W3C covers web interoperability/accessibility; OWASP covers authorization and
business transitions; PostgreSQL/node-postgres cover transaction ownership;
MusicBrainz/Picard cover domain identity and format interpretation. The reusable
[standards skill design](WEB_STANDARDS_SKILL_DESIGN.md) maps these practices to
real owners and evidence rather than applying an unrelated universal checklist.
