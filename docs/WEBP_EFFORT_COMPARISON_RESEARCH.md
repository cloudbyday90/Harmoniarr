# WebP effort comparison research

Reviewed October 25, 2026 through MCP-discovered primary sources. See separate
[design](WEBP_EFFORT_COMPARISON_DESIGN.md) and [outcome](WEBP_EFFORT_COMPARISON_OUTCOME.md).

| Official source | Applicable guidance |
| --- | --- |
| [libwebp 1.6 encoder](https://github.com/webmproject/libwebp/blob/v1.6.0/src/enc/webp_enc.c) | Method below 3 disables the token-buffer path used by method 4. This is a mechanism to evaluate, not proof of the wrapped pipeline's memory or quality. Blob `1e7ee67c2cd8d4c739037fdb2cc9622628c6a3a2`. |
| [Sharp output](https://sharp.pixelplumbing.com/api-output/) | WebP exposes effort and quality independently. Keep all other options fixed and inspect actual output. |
| [Google cwebp](https://developers.google.com/speed/webp/docs/cwebp) | Method trades encoding speed against compressed size and quality. Equal quality settings do not imply identical output or pixel error. PSNR/SSIM are diagnostic comparisons. |
| [Sharp security](https://sharp.pixelplumbing.com/security/) | Bound untrusted image dimensions, use timeouts and keep native dependencies current. Retain existing worker isolation and admission while evaluating the encoder. |
| [OWASP file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Layer content validation, size limits and least-privilege file access. Pin inputs, strip metadata and give only the parent explicit artifact-write authority. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Results, waiting and errors need programmatically determinable status without forced focus. Preserve existing feedback; native measurements alone establish no accessibility conformance. |

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Fixed-input effort comparison plus explicit failed outcomes | Measures the supported alternative within existing limits | Selected content only; full paired quality may be unavailable. Recommended. |
| Fixed center crop for paired metrics | Enables a bounded same-source method comparison | Cannot establish full-size resource behavior or natural-image perceptual quality. Supporting evidence only. |
| Immediately switch production globally or add automatic fallback | Might recover some failed images | Changes compression/output behavior and retry ownership before representative evidence. Defer. |
| Raise effort 4's cap or tune the image to get a reference | Can produce a comparison output | Changes the selected resource contract. Reject for this comparison. |

## Recommendation stack

1. Fixed input, output settings and isolated equal-resource encoder cases.
2. Actual owned outcomes, artifacts and child/container retirement.
3. Separate decoded-input RGB metrics and clearly scoped paired crop results.
4. Focused tests, opt-in native checks and exact retained evidence.
5. Representative quality/capability review before changing production policy.
