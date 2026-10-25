# Noisy WebP qualification research

Reviewed October 25, 2026 using MCP-discovered official pages. See the separate
[design](WEBP_ADMITTED_BOUNDARY_DESIGN.md) and [outcome](WEBP_ADMITTED_BOUNDARY_OUTCOME.md).

| Source | Application to this change |
| --- | --- |
| [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/) | Bound geometry and choose sequential input; header-derived pixel limits alone do not establish complete native rewrite behavior. |
| [Sharp metadata](https://sharp.pixelplumbing.com/api-input/) | Metadata reads headers without decoding pixels. Admission checks need separate actual processing evidence. |
| [Sharp output](https://sharp.pixelplumbing.com/api-output/) | Fix WebP quality/effort, preserve production output settings and inspect the actual rewritten metadata. |
| [Sharp security](https://sharp.pixelplumbing.com/security/) and [0.35.5 release](https://sharp.pixelplumbing.com/changelog/v0.35.5/) | Current guidance treats input as untrusted and recommends cgroup resource bounds. The installed 0.35.5 release is dated September 27, 2026; this fixture change keeps the binary and containment controls unchanged. |
| [WebP 1.6 API](https://developers.google.com/speed/webp/docs/api) | Decode and encode have distinct settings and owned buffers. Lossy quality changes pixel information, so identify the selected content precisely. |
| [Pinned libvips writer](https://github.com/libvips/libvips/blob/v8.18.7/libvips/foreign/webpsave.c) | Blob `e061526260b1006c0ebc1c406e408d843959b675` uses `WebPMemoryWrite` and reports a generic error when `WebPEncode` fails. This source does not establish which error occurred in the captured run. File output still uses that internal writer. |
| [OWASP file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Keep allowed formats, metadata removal and resource containment. Rewriting alone does not establish safety. |
| [W3C status guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Preserve accessible status ownership where results reach the UI. These backend/native tests do not substitute for screen-reader acceptance. |

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Fixed noisy fixture near numeric admission; pin and prepare separately | Reproducible hard input, honest processing result, less repeated setup | Selected case only; pins depend on runtime identity. Recommended. |
| Separate bounded-outcome characterization from strict publication | Preserves safety evidence and the failed success check explicitly | Does not repair the encoder or qualify successful processing. Recommended for this failing candidate. |
| Generate inside every measured application profile | Simple single entry | Preparation confounds peaks and repeats expensive encoding. Reject. |
| Search dimensions/quality until success | Finds a working example | Masks failed candidates and weakens the acceptance claim. Reject. |
| Raise limits or relax success assertions | Easier green result | Changes the contract or hides the actual failure. Reject. |
| Re-run every unaffected SQL/browser/native suite | Broad repetition | Slow and provides little new evidence when relevant source/runtime bytes match. Retain reviewed evidence instead. |

## Recommendation stack

1. Fixed geometry, encoder settings and deterministic source chosen before outcomes.
2. Source-pinned bytes, owned bounded reads and read-only consumers.
3. Numeric admission plus actual sanitized publication and retirement.
4. Fresh constrained mixed profiles, focused regressions and one fast gate.
5. Exact proof retention, separate preparation costs and explicit claim limits.

Keep shared format-aware accounting and existing limits. A positive arithmetic
margin is an estimate, not a promise that all native allocations will succeed.

The fixed candidate fails both buffer and file-output rewrite controls, while
minimal decode and statistics controls succeed. Generic native encoder/write
errors do not prove an allocator cause or deadline expiry. Retain the opaque
production error and gather structured native encoder/allocator evidence before
changing accounting or output ownership.
