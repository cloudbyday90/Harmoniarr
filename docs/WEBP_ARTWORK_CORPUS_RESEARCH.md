# WebP artwork corpus research

Reviewed October 25, 2026 through MCP search, official page retrieval and linked
asset discovery. See [design](WEBP_ARTWORK_CORPUS_DESIGN.md) and
[outcome](WEBP_ARTWORK_CORPUS_OUTCOME.md).

| Primary source | Application |
| --- | --- |
| [Google cwebp](https://developers.google.com/speed/webp/docs/cwebp) | Encoding method trades time, size and quality; equal quality settings do not imply equal output quality. Pair measurements on the same decoded inputs. |
| [Sharp output](https://sharp.pixelplumbing.com/api-output/) | Fix quality while varying only supported effort; record actual output and keep lazy-pipeline timing distinct from process overhead. |
| [Sharp security](https://sharp.pixelplumbing.com/security/) | Bound dimensions and execution; preserve isolation and current native dependencies. |
| [Sharp resizing](https://sharp.pixelplumbing.com/api-resize/) | A future explicit output cap can preserve aspect ratio and prohibit enlargement. JPEG/WebP shrink-on-load may help, but has quality/dimension tradeoffs; measure it and retain input-decode accounting. No cap is adopted in this change. |
| [Met API](https://metmuseum.github.io/) and [object 436535](https://collectionapi.metmuseum.org/public/collection/v1/objects/436535) | The official object response identifies the public-domain painting and actual image URLs. A documentation example URL differs from the current object: use the response, never guess it. |
| [Met terms](https://www.metmuseum.org/policies/terms-and-conditions) | Open Access images are provided under CC0; retain attribution and original provenance. |
| [NASA Blue Marble](https://svs.gsfc.nasa.gov/30613/) | Official photograph, credit and linked JPEG; use fixed downloaded bytes outside measured work. |
| [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) | Attribute NASA imagery used for factual/informational comparison; no endorsement claim. Check source-specific third-party credits. |
| [W3C image tutorial](https://www.w3.org/WAI/tutorials/images/) and [status guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Preserve image alternatives and programmatically available statuses. A codec corpus does not establish UI accessibility or replace deferred human acceptance. |

## Options and recommendation stack

| Option | Benefit | Cost / recommendation |
| --- | --- | --- |
| Four content classes, pinned inputs, three repetitions | Broader evidence with bounded local cost | Small corpus, RGB8 and modest sizes only. Recommended screening step. |
| Separate metrics and fixed visual crops | Exposes size/error/edge tradeoffs | Metrics do not establish perceptual equivalence; retain human review as a separate requirement. |
| Immediate global effort switch | Could recover some large rewrites | Changes compression behavior before representative acceptance. Defer. |
| Automatic fallback after failure | May improve processing capability | Adds retry/resource/publication ownership and repeated expensive work. Requires a separate design. |
| Raise limits or tune thresholds after results | Could obtain a passing result | Invalidates this predeclared comparison. Reject. |
| Evaluate a lossless rewrite for already-lossless graphic inputs | Could avoid lossy error and graphic-output inflation | Requires trustworthy input facts, bounded resource qualification and sanitization; recommended next experiment, not an automatic passthrough. |

Recommended stack: existing production guards and effort 4; pinned provenance and
isolated comparisons; separate metrics plus explicit screening outcomes; visual
review; then a separately justified production-policy decision. Numerical limits
are project screening choices, not values prescribed by Google, Sharp or W3C.
Sharp separately supports explicit `lossless` WebP encoding. The corpus outcome
identifies a concrete reason to evaluate that supported mode before designing a
new production selection rule. Photographic lossless output can be much larger;
do not infer a universal lossless preference from a simple graphic.
