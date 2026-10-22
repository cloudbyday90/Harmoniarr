# Fanart.tv response research — October 2026

Consulted on October 22, 2026 through MCP search and open/find. URLs were
discovered from official results. Source status and evidence limits are explicit.

| Official source / status | Applicable practice | Project application |
| --- | --- | --- |
| [Fanart.tv API](https://api.fanart.tv/), vendor reference available in MCP indexed content; direct open returned 403 | Project/personal keys can use headers; v3.2 missing resources use 404; 429 uses Retry-After | Preserve header credentials, 404-empty compatibility and existing retries. Indexed reference describes v3.2 albums as an array keyed by release_group_id, unlike the current flat selector; schedule separate target-bound normalization |
| [Undici README](https://github.com/nodejs/undici/blob/main/README.md), current implementation guidance | Body mixins buffer; enforce application limits while streaming and consume/cancel bodies | Reuse decoded-byte reader and cancel ignored bodies; qualify bundled 7.30.1 behavior instead of assuming current-main extensions |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude credentials/sensitive data; verify diagnostics | Approved error projection across transport, parser, credential-resolver and configuration failures |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement 15 May 2025, not a Recommendation | Minimize unnecessary data use and exposure | Apply minimization to retained provider diagnostics as an architectural inference; no conformance or accessibility claim follows |
| [RFC 9110 section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.pdf), IETF Standards Track, June 2022 | Retry-After accepts HTTP dates or non-negative integer seconds | Preserve both forms; reject automatic scheduling beyond the host timer range without shortening the requested wait |
| [Node 24 timers](https://nodejs.org/docs/latest-v24.x/api/timers.html), vendor documentation reached through official version navigation | Delays above 2,147,483,647 ms become 1 ms | Bound timeout configuration and defer automatic retries outside that range. A separate actual Node 24.22.1 probe reproduced the overflow warning and near-immediate callback |

Recommendation: shared bounded parsing and a provider-specific request owner.
This reduces accepted input and error-data retention without changing credential
storage or image priority. The 2 MB budget is a project tradeoff; no official
maximum was established and unusually large artist catalogues may be refused.
Decoded-byte accounting does not cap decompressor allocation or total parsed heap.

Next: wire stored/environment Fanart.tv credential resolvers into the default
artwork module. Source tracing found the resolver methods in the provider
credentials service, but app.js passes only settings/maintenance dependencies
and artwork-module.js constructs createFanartTvClient() without those resolvers;
the client's defaults return null. Injected-header tests do not prove that saved
keys reach the default application path. Then verify v3.2 album envelopes against the requested release-group
identity, with explicit legacy version controls and actual artwork publication.
Also retain a separate review item for image download URL/redirect/byte policy;
JSON qualification does not prove safety of the image bytes subsequently fetched.

## No-cache runtime package drift

The rebuild downloaded Alpine `brotli-libs` 1.2.1-r0 instead of the preceding
1.2.0-r0. The strict runtime comparison stopped before Compose replacement.
Official navigation then verified the [1.2.1 release](https://github.com/google/brotli/releases/tag/v1.2.1),
its [decoder correction](https://github.com/google/brotli/commit/b418fa81c48262a86a95332b0bc6d62c30aa78b6)
and the [Alpine v3.23 package](https://pkgs.alpinelinux.org/package/v3.23/main/riscv64/brotli-libs).
The latter page describes riscv64; actual Linux amd64 package identity comes
from the built image inventory. The release addresses CVE-2026-111497.

The OS shared library is separate from Node's bundled Brotli. The
[Node 24.22.1 release](https://nodejs.org/en/blog/release/v24.22.1/)
explicitly includes the security backport while retaining the 1.2.0 component
version string. That string alone does not indicate a missing fix. The actual
Node executable hash remains unchanged.

Accept only the reviewed OS package substitution after comparing all other
package/runtime metadata and testing the extracted exact native libraries.
Keep the update rather than pinning a known preceding package to force equality.
Do not infer an exploit reproduction from ordinary round trips or an error-enum
marker. See the [Docker outcome](LOCAL_DOCKER_FANART_RESPONSE_OUTCOME.md).
