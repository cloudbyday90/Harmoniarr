# WebP canvas research and recommendation

Reviewed October 25, 2026 through MCP discovery, official documentation and pinned
GitHub file retrieval. Runtime: Node 24.22.1, Sharp 0.35.5, libvips 8.18.7,
libwebp 1.6.0, GLib 2.90.0. See [design](WEBP_CANVAS_MEMORY_DESIGN.md) and
[outcome](WEBP_CANVAS_MEMORY_OUTCOME.md).

| Official source | Applicable finding |
| --- | --- |
| [libvips 8.18.7 WebP loader](https://github.com/libvips/libvips/blob/v8.18.7/libvips/foreign/webp2vips.c) | The loader constructs an eight-bit four-band memory frame, then can expose RGB output. Visible channel count alone omits this canvas. Source supports the extra cost; it is not a captured allocation stack. |
| [libvips 8.18.7 WebP writer](https://github.com/libvips/libvips/blob/v8.18.7/libvips/foreign/webpsave.c) | The writer holds a contiguous frame and memory writer even for file targets. Switching toFile does not remove those costs or the decoder canvas. The direct probe still fails. |
| [WebP 1.6 API](https://developers.google.com/speed/webp/docs/api) | Decoding/encoding use separate buffer and picture ownership. Test minimal operations separately from their combined pipeline; do not infer complete rewrite success from a decode control. |
| [Sharp input](https://sharp.pixelplumbing.com/api-input/) and [output](https://sharp.pixelplumbing.com/api-output/) | Header metadata and pixel-derived work are distinct; native output modes have different interfaces. Keep production encoder settings and validate actual output. |
| [Node 24 CLI](https://nodejs.org/download/release/v24.20.0/docs/api/cli.html) | Old-space limits govern V8's old generation, not every native allocation. Retain separate native and aggregate controls. This is versioned Node 24 guidance, not a claim that the documentation version equals the installed 24.22.1 binary. |
| [Linux prlimit](https://man7.org/linux/man-pages/man1/prlimit.1.html) | Set the child's hard and soft DATA limits before exec. An allocation limit is distinct from observed cgroup usage. |
| [OWASP file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Decode/re-encode allowed formats, remove unnecessary metadata and restrict the processor's resources. Rewriting alone does not make arbitrary content safe. |
| [IETF HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Preserve owned capacity failures and bounded client handling. This change retains the existing internal 503 contract; the same image will continue to fail numeric admission, so do not promise that waiting or automatic retry will repair it. |
| [W3C WCAG 2.2 status guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Existing user-facing results should remain programmatically available without moving focus. No UI path changes here; native tests do not establish screen-reader acceptance. |

The pinned loader blob is `fbdf87670df32fa224f22edf67eb9b8c301facef`;
the writer blob is `e061526260b1006c0ebc1c406e408d843959b675`. These
identify retrieved vendor source, not a production allocation trace.

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Add the known WebP RGBA canvas to shared admission accounting | Deliberate refusal before expensive work; child and parent stay consistent; no new authority | More conservative acceptance for large WebP, including images with no alpha. Recommended. |
| Change only output to a temporary file | Could avoid a returned output-buffer copy | Does not remove the full-frame canvas/writer; tested failure remains. Adds cleanup/cancellation authority. Reject as this fix. |
| Raise DATA/heap or change format/quality | Might permit the selected image | Changes the resource or output contract without an accepted envelope. Not selected. |
| Match native error text as a memory classification | Easy apparent classification | Vendor text is unstable and cannot safely identify every cause. Preserve opaque native errors; use numeric admission instead. |
| Redesign decode/encode staging or supported dimensions | Potentially supports harder images within a measured budget | Requires a separate capability/ownership design and accepted-boundary evidence. Future work if needed. |

## Recommendation stack

1. Source-backed, format-aware decoder cost inside the existing shared estimate.
2. Owned pre-grant memory refusal and unchanged native/container controls.
3. Explicit boundary expectations plus JPEG and medium-WebP success controls.
4. Focused fast tests and opt-in native composition/retirement checks.
5. Preserve separate diagnostics, inference limits and unaffected proof retention.

W3C status/accessibility and HTTP/security guidance remain applicable to the
existing result path; this backend change does not establish new UI conformance.
Do not promise successful processing merely because an arithmetic estimate fits.
