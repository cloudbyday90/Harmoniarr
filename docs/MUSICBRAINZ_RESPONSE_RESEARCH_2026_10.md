# MusicBrainz response research — October 2026

Consulted through MCP search and page open/find on 22 October 2026 UTC
(21 October local work date). URLs below were discovered from official results.
This is a scoped transport decision, not an accessibility or security certification.

| Official source and status | Applicable practice | Project decision / evidence |
| --- | --- | --- |
| [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), vendor documentation | Meaningful User-Agent, at most one call per second; browse limit up to 100; releases may yield short pages and at least one complete release beyond 500 tracks | Preserve includes, limits, offsets and queue; test large media payloads and actual result counts. Byte budgets are project policy |
| [MusicBrainz search](https://musicbrainz.org/doc/MusicBrainz_API/Search), vendor documentation | Search limit 1–100 and offset; separate lookup, browse and search shapes | Keep search/browse contracts distinct; do not interpret a short page as truncated JSON |
| [Rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting), vendor documentation with historically dated rules subject to change | Throttling uses application, source IP and global load; rejection can be HTTP 503 | Keep serial admission, 429/503 metadata and existing Retry-After/backoff policy; no extra retries on invalid successful bodies |
| [Undici README](https://github.com/nodejs/undici/blob/main/README.md), implementation guidance on current main | Body mixins buffer; stream with an application size limit; consume or cancel responses rather than rely on GC | Count decoded stream bytes, cancel ignored bodies, qualify bundled Node/Undici using native HTTPS. Do not assume current-main extensions exist in bundled 7.30.1 |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude credentials/sensitive data and verify diagnostic behavior | Approved codes and numeric retry/status metadata; no arbitrary request URL, body, header or cause retention |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/), Recommendation 23 November 2021 | Trace fields must avoid sensitive information; header propagation creates privacy boundaries | Diagnostic minimization is an architectural inference here; this work adds no trace propagation and establishes no general W3C conformance |

Recommendation: operation-specific byte caps and a narrow request owner provide
bounded allocation with compatibility headroom. A cap limits decoded input, not
total heap or parsing CPU. The single client queue reduces overlapping payload
materialization for that client; multiple instances/processes still share provider
IP quotas. Synthetic fixtures establish tested boundaries, not a provider maximum.

Next priority: qualify Fanart.tv's JSON response boundary. Its current
`fanart-client.js` still materializes successful JSON without a byte budget and
returns/retries HTTP errors without cancelling their bodies. Preserve its
artist/album image selection, credential headers, 404-empty behavior and
Retry-After policy with separate native evidence. Then consider
bounded aggregate provider admission across multiple instances if measurements
show concurrent queues exhausting process or source-IP budgets. Keep source
selection, implementation policy and native evidence separate in the reusable
[provider HTTPS skill reference](../.agents/skills/harmoniarr-testing-validation/references/provider-https.md).
