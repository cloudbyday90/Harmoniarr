# WebP encoder boundary research

Reviewed October 25, 2026 through MCP-discovered primary sources. See separate
[design](WEBP_ENCODER_BOUNDARY_DESIGN.md) and [outcome](WEBP_ENCODER_BOUNDARY_OUTCOME.md).

| Official source | Applicable evidence |
| --- | --- |
| [libwebp 1.6 encoder API](https://github.com/webmproject/libwebp/blob/v1.6.0/src/webp/encode.h) | The picture owns a structured encoder error code. Value 1 identifies out-of-memory allocation failure. |
| [Encoder initialization](https://github.com/webmproject/libwebp/blob/v1.6.0/src/enc/webp_enc.c) | Token page sizing uses macroblock count and quality. At quality 90 it requests 22 tokens per macroblock, subject to the page minimum. |
| [Token pages](https://github.com/webmproject/libwebp/blob/v1.6.0/src/enc/token_enc.c) | A page has an eight-byte next pointer on supported 64-bit targets plus two bytes per token, with at least 8192 tokens. Pages accumulate with content-dependent encoding work. |
| [libvips 8.18.7 writer](https://github.com/libvips/libvips/blob/v8.18.7/libvips/foreign/webpsave.c) | The writer maps quality/effort to libwebp and collapses encoder failure into generic text; file output retains native encoder allocations. |
| [Linux resource limits](https://www.man7.org/linux/man-pages/man2/getrlimit.2.html) | Writable allocation can fail with ENOMEM when DATA would be exceeded. Address-space and mapping-count evidence help distinguish other limits. |
| [strace](https://strace.io/) and [GDB](https://sourceware.org/gdb/current/onlinedocs/gdb) | Trace syscall failure and observe actual native state on a pinned binary. Debugger timing and memory overhead remain separate from production measurements. |
| [Sharp security](https://sharp.pixelplumbing.com/security/) and [OWASP file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Preserve resource containment, allowed formats and metadata removal; keep diagnostic tooling outside the deployed runtime. |
| [W3C status guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Existing user-facing results need accessible status ownership. This backend/native change establishes no new screen-reader conformance. |

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Add one source-derived encoder growth unit plus allocator slack to shared admission | Small explicit calibration; refuses the known failing candidate before expensive work; parent/child remain consistent | Does not bound all token pages or guarantee other admitted images succeed. Recommended with scoped qualification. |
| Treat generic native text as a memory classification | Simple apparent reporting | Text is unstable and hides the structured cause. Reject in production. |
| Raise DATA or change quality/effort | Might permit the image | Changes the resource or output contract; does not fix accounting. Not selected. |
| Switch to file output | Could reduce final output copies | The token-buffer failure still occurs with file output. Not this fix. |
| Derive a complete worst-case token bound or evaluate supported low-memory encoding | Stronger future envelope | Can materially reduce accepted dimensions or change encoder behavior; needs a separate capability/quality/performance decision. Follow-up. |

## Recommendation stack

1. Pin input, binary and source identity before interpreting diagnostics.
2. Observe native error, allocation unit and limit state without production text matching.
3. Share encoder settings and a source-derived growth reserve across child/parent accounting.
4. Prove pre-grant refusal plus unchanged JPEG and smaller-WebP success under existing limits.
5. Keep claim limits, exact evidence retention and subsequent envelope work explicit.
