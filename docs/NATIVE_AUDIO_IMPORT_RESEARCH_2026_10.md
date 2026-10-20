# Native audio import research and recommendations

Consulted October 20, 2026. GitHub MCP refreshed repository/PR metadata; MCP web
search discovered and opened the official sources below.

| Source and status | Application |
| --- | --- |
| [ffprobe documentation](https://ffmpeg.org/ffprobe-all.html), vendor docs | Inspect actual format/streams and errors. Metadata probing is not a full decode or original-source authentication claim. |
| [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html?trk=public_post_comment-text), informative guidance | Apply content checks and bounded storage to untrusted provider files by design inference; extension/declared size alone is insufficient. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), IETF standard | Preserve durable mutation ownership and conservative uncertain-POST recovery rather than issuing another command. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), Recommendation | Record version/provenance across native transport, exported bytes and canonical publication. This is an evidence-design inference, not accessibility or protocol certification. |

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Treat completed transfer as import acceptance | Simple | Cannot reject equal-length invalid media | Reject |
| Substitute provider receipts or inspection results | Fast | Breaks evidence at the boundary being qualified | Keep pure controls separate |
| Internal native provider plus real SQL/inspection/apply | Actual durable ownership, content refusal and canonical bytes | Slower opt-in fixture; explicit hash-preserving export boundary | Recommend |
| Full browser/search/live-provider replay | Broad journey | External accounts, network and unrelated state add uncertainty | Separate follow-up |

Final stack: declared bounded WAV data, one-use native capabilities, actual
client/service through a narrow Docker command bridge, real leased execution and
durable receipts, retired-producer hash-preserving export, actual media inspection,
canonical safe-add/apply/catalog/audit proof, isolated PostgreSQL and strict cleanup.
Keep the lane opt-in; reuse existing workers and guards rather than creating a
parallel import pipeline.
