# Native file-transfer research and recommendation stack

Consulted October 20, 2026. Discovered primary URLs through GitHub MCP repository,
tag, source and PR metadata and MCP web search, then opened them. Release source
is distinct from current default-branch source and public API documentation.

| Source and status | Applicable boundary |
| --- | --- |
| [Released Soulseek.NET connection manager](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/Network/PeerConnectionManager.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Direct transfer writes framed PeerInit F and then the raw transfer token. |
| [Released client](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/SoulseekClient.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Allowed TransferResponse includes size; downloader sends raw 64-bit start offset before reading the exact remaining bytes. |
| [Released slskd download service](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Transfers/Downloads/DownloadService.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | Success state is persisted before the incomplete file moves to its destination. Observe filesystem publication separately. This release links Soulseek.NET 10.0.2. |
| [Node 24 stream API](https://nodejs.org/download/release/v24.20.0/docs/api/stream.html), versioned API documentation | Write callbacks/backpressure, finish and actual close are separate boundaries. Consulted 24.20 reference; actual execution uses canonical 24.22.0. |
| [Node 24 filesystem API](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html), versioned API documentation | Descriptor stats, bounded reads, no-follow open and awaited close support file identity evidence. |
| [Compose volumes](https://docs.docker.com/reference/compose-file/volumes/) and [Docker volumes](https://docs.docker.com/engine/storage/volumes/), vendor guidance | Project-scoped managed volume, driver options and independent read-only inspector mount. Verify actual daemon result. |
| [Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html), OWASP informative guidance | Non-root, capability removal, bounded resources and read-only execution. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), IETF standard | An unknown non-idempotent POST result does not authorize automatic resend. Preserve exact GET recovery. |
| [Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), W3C Recommendation | Version/provenance guidance informs evidence design by inference; it does not certify private binary transport or accessibility. |
| [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), vendor migration guidance | Compiler/tooling compatibility must be checked at the actual language-server consumer, separately from native provider work. |

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Existing queue receipts only | Fast, already qualified | Cannot prove bytes or published files | Retain as a separate admission lane |
| Provider database/file seeding | Simple to arrange | Bypasses the protocol and publication owner | Reject for native completion claims |
| Controlled actual binary transfer | Real receipts, bytes, hashes and filesystem publication | More fixture code and Docker startup | Adopt as a small opt-in lane |
| Live public peer/account | Broad operational realism | Credentials, availability and uncontrolled content | Keep outside deterministic qualification |

Final stack: narrow ESM framing/negotiation/sender modules, declared payload and
token authority, actual client/service receipt flow, read-only bounded file
inspection, strict isolated Docker ownership, focused adverse controls and one
final fast gate. Keep production architecture and the default integration
inventory unchanged. Next scope should follow the remaining unproved boundary,
not turn protocol evidence into an assumed library-import guarantee.
