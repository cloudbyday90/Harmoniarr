# Native resume research and recommendation stack

Consulted October 20, 2026. GitHub MCP discovered repository/tag/source and PR
metadata; MCP web search discovered and opened the official guidance below.

| Source and status | Applicable decision |
| --- | --- |
| [Released configuration](https://api.github.com/repos/slskd/slskd/contents/docs/config.md?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), vendor documentation | Defaults resume partial files with three attempts and bounded backoff. Keep the native default configuration unmodified. |
| [Released download service](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Transfers/Downloads/DownloadService.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | Resume takes its offset from current incomplete-file length. Native retries update the same transfer and local queue state. Same-size source changes remain a documented integrity limit. |
| [Released retry loop](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Common/Retry.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | attempts is a total invocation limit. Test second-invocation success without interpreting it as a new application POST. |
| [Released backoff calculation](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Common/Compute.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | The first retry has zero fixed delay plus 0..4,999 ms jitter with defaults. Do not require a five-second minimum or make transient-state polling the retry proof. |
| [Soulseek.NET client](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/SoulseekClient.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Negotiate an explicit offset and read only the remaining declared bytes. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), IETF standard | Uncertain non-idempotent requests need evidence before retry. Retain the application GET-only recovery contract. |
| [Node net documentation](https://github.com/nodejs/node/blob/main/doc/api/net.md), current vendor documentation | FIN/RST and actual socket close are separate boundaries. Test on canonical Node 24.22.0; current main documentation is not a pinned runtime source. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), Recommendation | Apply version/provenance principles to evidence by design inference; this is not private-protocol or accessibility certification. |
| [OWASP Docker Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html), informative guidance; [Docker networks](https://docs.docker.com/reference/compose-file/networks/) and [volumes](https://docs.docker.com/reference/compose-file/volumes/), vendor guidance | Preserve externally isolated networking, bounded private volumes, read-only inspector access and least privilege. |

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Application resends POST after a native fault | Superficially simple | Can duplicate intent and bypass durable recovery ownership | Reject |
| Accelerated fixture retry settings | Faster feedback | Does not qualify the released default backoff/configuration | Keep separate if later needed |
| Actual default retry with bounded second-attempt success | Real native ownership, explicit offsets and exact final content | Slower opt-in lane; unchanged-source proof only | Implement |
| Broad hostile-source/resume matrix now | Wider integrity coverage | More independent failure dimensions and attribution cost | Follow after this lane |

Final stack: unchanged provider defaults, bounded per-file token capabilities,
actual partial-prefix inspection, explicit offset range sends, stable application
receipt identity and GET-only recovery, retired-producer full-hash proof, focused
adverse tests and one final fast gate. Keep native lanes opt-in. Do not claim
resume authenticates the original source or removes the need for import checks.
