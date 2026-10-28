# Bounded folder browsing research

Consulted October 28, 2026 through MCP search and opened official sources.
Installed baseline: Node 24.22.1, Vue 3.5.44 and Chromium 156.0.8078.4.

| Source / status | Application decision |
| --- | --- |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html) — runtime documentation | Use opendir with bufferSize 32 and sequential reads; await close before releasing scan capacity. Directory iteration order is unspecified and concurrent membership changes may be missed. |
| [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) — security guidance | Keep administrator authorization on every read, validate query/token sizes and return bounded public errors. |
| [OWASP denial-of-service guidance](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html) — security guidance | Bound active scans, retained candidates, scanned entries and cooperative elapsed work. Refuse excess work explicitly. These numerical limits are project choices. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) — informative WCAG 2.2 guidance | Announce page range, loading, completion and refusal through the persistent status node. |
| [W3C focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) — informative WCAG 2.2 guidance | Explicit native Previous/Next/Start again buttons and persistent navigation focus preserve operability when a page replaces its controls. |
| [Node 24 crypto API](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html) — documented preceding Node 24 release; APIs also exercised on installed 24.22.1 | Generate a process-local random key, HMAC navigation payloads and compare equal-length signatures with timingSafeEqual. This does not make all surrounding code timing-safe. |

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Full readdir then slice | Simple; retains existing sort | Materializes the complete directory; does not meet the memory goal. Rejected. |
| Retained open directory cursors | Continues without rescanning | Needs bounded actor-owned leases, expiration, explicit release, restart handling and unspecified-order semantics. More lifecycle state than this picker needs. Deferred. |
| Streamed sorted keyset pages | Fixed retained page, no idle directory handles or cursor registry, deterministic navigation | Rescans the directory on each page; metadata fences are not transactional snapshots. Selected with explicit scan/admission limits. |
| Virtualize an unbounded client list | Fewer DOM nodes | Still retains complete response/server arrays and adds keyboard complexity. Rejected. |

## Final recommendation stack

1. Thin admin-only, no-store GET adapter and one scoped ESM filesystem service.
2. Sequential opendir reads, 32 native buffered entries, at most 100 retained folder candidates; 100 folders per response.
3. At most four scans per application instance, 50,000 scanned entries and a cooperative five-second work budget. Excess requests/refused scans return no partial success.
4. Signed, expiring actor/path/directory-metadata cursors for bidirectional keyset navigation. A cursor conveys navigation state, never filesystem authorization.
5. Replace client pages; retain only current previous/next cursors, retry intent and at most 100 entries. Explicit Previous/Next, retry and Start again preserve confirmed selection and existing draft/save ownership.
6. Verify actual filesystem traversal/closure and page parity, HTTP authorization/abort, client stale-response fences, browser keyboard/reflow/zoom and the packaged Linux implementation.

Resource counts and metadata-based refusal are application inferences from the
sources. Cooperative checkpoints cannot interrupt a stalled native filesystem
operation; capacity remains held until it and close settle. Node prefetching and
runtime overhead are distinct from retained application entries. No whole-process
RSS or throughput improvement is claimed without measurement.
