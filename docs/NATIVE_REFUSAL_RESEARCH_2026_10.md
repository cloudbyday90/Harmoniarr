# Native refusal research and recommendations

Consulted October 20, 2026. GitHub MCP refreshed repository/tag/PR metadata and
opened immutable source; MCP web search discovered and opened official guidance.

| Source and status | Applicable decision |
| --- | --- |
| [Released retry loop](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Common/Retry.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable vendor implementation | Three attempts means three total invocations; keep application POST ownership separate. |
| [Released download service](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Transfers/Downloads/DownloadService.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | Size mismatch is excluded from retry; failed intermediate library states can still map to local queue before final exhaustion. |
| [Soulseek.NET 10.0.2](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/SoulseekClient.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | A changed acknowledged size throws before the file connection opens. Test absence of that connection as well as failure evidence. |
| [Released configuration](https://api.github.com/repos/slskd/slskd/contents/docs/config.md?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396) and [backoff](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Common/Compute.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), vendor docs/implementation | Inspect effective resume/attempt/delay settings. First retry has zero fixed delay plus jitter; polling every transition is not the retry proof. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), IETF standard | Unknown non-idempotent acceptance needs evidence before retry. Retain GET-only application recovery. |
| [Node net API](https://nodejs.org/api/net.html), current vendor documentation | EOF signaling and actual socket retirement are distinct. Current page is 26.12.0; execute and validate canonical Node 24.22.0. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), Recommendation | Version/provenance principles inform evidence attribution by design inference, without implying private-protocol or accessibility certification. |
| [OWASP Docker Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html), informative guidance | Keep private bounded storage, read-only inspection, least privilege and resource limits. |

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Assert failure from injected JSON | Fast | Bypasses actual retry, size negotiation and file publication | Keep pure controls separate |
| Automatically resend application POST | Superficially simple | Can duplicate intent and bypass durable recovery ownership | Reject |
| Native default exhaustion and changed-size refusal | Tests real exception/retry boundaries and final files | Slower opt-in lane; unchanged-prefix integrity scope | Recommend |
| Broad adversarial content matrix immediately | Wider scope | Adds independent decoding/source-identity dimensions | Follow after these boundaries |

Final stack: unchanged native defaults, bounded one-use capabilities, verified
prefix/offset ownership, actual native attempt and mismatch evidence, existing
failed classifiers and GET-only recovery, retired-producer file isolation,
focused adverse tests and one final fast gate. Keep long unrelated suites opt-in.
