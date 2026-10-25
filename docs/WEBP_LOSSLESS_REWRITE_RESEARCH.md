# WebP lossless rewrite research

Reviewed October 25, 2026 through MCP search and official page retrieval. See
[design](WEBP_LOSSLESS_REWRITE_DESIGN.md) and [outcome](WEBP_LOSSLESS_REWRITE_OUTCOME.md).

| Primary source | Applicable guidance |
| --- | --- |
| [Google WebP container](https://developers.google.com/speed/webp/docs/riff_container) and [RFC 9649](https://www.rfc-editor.org/info/rfc9649/) | RIFF framing, padded chunks, VP8X feature declarations and VP8L still-image data are distinct. A prefix or file extension is not complete content authority. |
| [Google lossless bitstream](https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification) | Check the VP8L signature, version and encoded dimensions within bounds. Its alpha bit is a hint, not proof that a decoder will produce transparent pixels. |
| [Sharp output](https://sharp.pixelplumbing.com/api-output/) | Explicit lossless WebP output is supported; default rewriting converts to sRGB and removes metadata unless preservation is requested. Verify actual output and decoded pixels. |
| [Google cwebp](https://developers.google.com/speed/webp/docs/cwebp) | Lossless quality controls compression effort; compare actual size/runtime and do not interpret the number as lossy visual quality. |
| [Sharp security](https://sharp.pixelplumbing.com/security/) | Retain dimension/time limits, process isolation and current native dependencies. No sanitization shortcut follows from an input's lossless label. |
| [Linux memory controller](https://cdn.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html) | Shared pages have charging ownership and v1 current usage is approximate. Process RSS and charged cgroup usage are separate observations, not additive private-memory totals. |
| [W3C images](https://www.w3.org/WAI/tutorials/images/) | Preserve contextual text alternatives and readable image content; native RGB equality is not UI accessibility acceptance. Existing human accessibility checks remain separate. |

## Options, pros and cons

| Option | Pros | Cons / recommendation |
| --- | --- | --- |
| Explicit sanitized lossless candidate on pinned inputs | Tests exact pixels, metadata removal and graphic size savings | Content-dependent resource/size costs. Recommended qualification. |
| Switch all WebP to lossless immediately | Avoids further lossy error | Photographic output may grow; current admission was calibrated for a different encoder path. Defer. |
| Copy already-lossless input unchanged | Cheap and pixel-preserving | Preserves untrusted metadata/container contents and bypasses sanitization. Reject. |
| Narrow structural facts plus actual decoder/rewrite evidence | Avoids confusing VP8X metadata with image encoding | Narrow facts are not a full bitstream validator. Keep test-only until a production design qualifies supported layouts. |
| Try both encoders automatically and choose smaller | Could optimize actual output size | Adds two encodes, two retained outputs and deadline/admission ownership. Requires a separate resource design. |

Recommendation stack: retain current production policy and hard limits; qualify
supported explicit lossless rewriting; prove bounded container facts, full decode
and exact pixels; report graphic/photographic tradeoffs; design any later selection
and memory/publication policy separately from this experiment.
