# Native partial-transfer research and recommendations

Consulted October 20, 2026. URLs were discovered using GitHub MCP repository/tag/
source/PR metadata and MCP web search, then opened. Immutable release source is
not interchangeable with a newer default branch.

| Source and status | Application |
| --- | --- |
| [slskd 0.26.1 retry helper](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Common/Retry.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | The loop starts at zero and runs below maxAttempts; one means one total call. Limit only the controlled fault lane. |
| [Released download service](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Transfers/Downloads/DownloadService.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | Failed attempts can retry/resume; terminal persistence, stream retirement and file movement are distinct boundaries. |
| [Soulseek.NET 10.0.2 client](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/SoulseekClient.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Reads declared remaining length; errors persist failure progress, finalize output and remove tracked downloads. Observe each boundary. |
| [Node net API](https://nodejs.org/api/net.html), vendor API documentation | end sends a graceful close; resetAndDestroy sends TCP RST. Current page identifies Node 26.12.0; actual fixture runs canonical Node 24.22.0 and tests its primitives. Local callback completion is not remote file receipt. |
| [Compose volumes](https://docs.docker.com/reference/compose-file/volumes/), vendor guidance | Inspect both bounded project-owned tmpfs identities and separate writer/read-only inspector access. |
| [Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html), OWASP informative guidance | Keep non-root execution, read-only roots, dropped capabilities, resource limits and private disposable storage. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), IETF standard | Preserve conservative unknown-POST handling; a failure observation does not authorize a second POST. |
| [Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), W3C Recommendation | Version/provenance guidance informs evidence design by inference. It does not certify private protocol tests, retry correctness or web accessibility. |

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Treat any terminal receipt as completion | Simple | Conflates failure, file publication and task retirement | Reject |
| Inject provider JSON/database state | Fast | Bypasses native truncation and storage ownership | Keep pure controls separate |
| Native EOF/RST with one attempt | Precise failure boundary, deterministic content and positive control | Does not exercise default retry/resume | Recommend for this slice |
| Full retry/resume matrix immediately | Wider coverage | More state, offsets, timing and ambiguous attribution | Defer until the single-fault boundary is qualified |

Final stack: declared ESM fault plans, bounded backpressure-aware sends, real
incomplete-prefix checkpoint, exact receipts and existing application classifiers,
read-only bounded file verification after producer retirement, strict Docker
cleanup, focused adverse tests and one final fast gate. Keep long timeout and
unrelated database inventories separate unless their owning behavior changes.
