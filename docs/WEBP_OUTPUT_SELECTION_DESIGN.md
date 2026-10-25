# Bounded WebP output selection design

October 25, 2026. Builds on the [qualified lossless rewrite](WEBP_LOSSLESS_REWRITE_OUTCOME.md).
See [research](WEBP_OUTPUT_SELECTION_RESEARCH.md) and [outcome](WEBP_OUTPUT_SELECTION_OUTCOME.md).

## Scope and selection

Enable a built-in sequential comparison only for still, opaque sRGB/uchar/three-
channel WebP inputs at most 1024 pixels per edge and 1 MiB compressed. Decoder
metadata must confirm no ICC profile, alpha or nontrivial orientation; a bounded
RIFF/VP8L inspector must agree on geometry and supported lossless layout. Unknown,
lossy, animated, profiled, alpha or unsupported layouts keep the existing path.
Structural facts do not replace native decoding or sanitization.

Rewrite both lossy and lossless at quality 90/effort 4, retaining the first output
while the second runs. Both must succeed and remain within the existing 100 MiB
per-output limit. Return the smaller sanitized buffer; prefer lossless on an exact
size tie. Do not write source bytes through or introduce an automatic failure retry.

## Resource ownership

The two encodes share one ten-second monotonic rewrite budget. Each native timeout
uses whole seconds rounded down from the remaining budget; insufficient time or
a late completion refuses the job. Sharp's processing timeout excludes libuv wait,
so pre/post clock checks and the parent's unchanged fifteen-second whole-job kill/
actual-close fence remain necessary. Statistics remain best effort afterward.

For a selected job, keep the original parent reservation: the full 1 GiB child
DATA ceiling, existing 64 MiB mapping allowance, parent input and two collector/
final-output copies. The child's DATA envelope includes both retained rewrite
outputs (at most 200 MiB) and all runtime/native working allocations. Do not shrink
using the lossy page-growth model or add isolated encoder peaks as a budget.
An optional strictly validated `webpSelection: true` metadata frame binds this
larger reservation before grant; ordinary metadata frames remain compatible.
Keep the reservation through child close and actual publication. This conservative
choice serializes selection jobs under the existing 2 GiB active budget; ordinary
jobs retain current shrinking behavior.

## Validation and rollout

Use small ESM modules for supported container facts, eligibility, and the injected
rewrite service. Preserve source inspection, native limits, framing, sanitization,
stats, storage and repository ownership. Pair parser/eligibility, shared admission,
protocol, size choice, timeout/failure and publication-hold unit checks with actual
native worker and PostgreSQL/file publication on the four pinned corpus inputs in
fresh 2/3 GiB profiles. Include queue serialization, exact selected hashes/pixels,
metadata removal, source checksums and no unselected artifacts. Re-run affected
worker/lifecycle/corpus and mixed-memory controls; retain unrelated proof only
after exact source/runtime review. Use one stable fast gate after focused checks.

Rebuild the walkthrough without cache, preserving existing admin/data and all five
actual binds. Work on main, commit/push all changes, and create no release/branch.
