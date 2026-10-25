# Prepared admitted artwork qualification

For current WebP admission expectations also read
[canvas memory](webp-canvas-memory.md). The prepared bytes remain pinned; the
canonical boundary descriptor now expects early refusal for the large WebP and
successful JPEG publication. The former admitted command/selector remain aliases.

Use for selected noisy-source images inside shared memory admission. Read
active-repo docs/ARTWORK_ADMITTED_BOUNDARY_DESIGN.md, research/outcome and
[rewrite accounting](artwork-rewrite-headroom.md).

- Select fixed format/quality settings before observing decoder outcomes. Lower
  quality changes decoded information: say noisy-source lossy input, not arbitrary
  incompressible pixels or a universal accepted envelope. Do not pad these cases
  or tune input until processing passes.
- Prepare via `prepareBoundaryArtworkInputs` once on the pinned Linux runtime
  into a fresh explicit output directory. Keep raw-source cleanup, version/byte/
  SHA verification and producer resource evidence. Existing output is refused;
  do not automatically delete or overwrite it. Binaries stay outside Git.
- Consumers require an explicit read-only `/boundary-inputs` mount and fixed
  descriptors. Pin hashes in source; a mutable manifest's own digest is not trust.
  Exact-size bounded file-handle reads, EOF and hash checks precede use. Never
  silently regenerate a missing or changed artifact inside a measured profile.
- Test actual handle retirement after success, mismatch, truncation and Error/null
  cancellation with tiny files. Keep actual codecs/preparation outside the fast
  gate. Prepared artifact bytes must match across each fresh native profile.
- Prove the input is admitted, then distinguish publication from owned processing
  refusal. An allocation estimate is not a successful-processing promise. Native
  abort or kernel limit/OOM change fails this admitted qualification; do not call
  it graceful refusal. Preserve publication/assignment/hash and complete inventory
  checks, actual close, lease/reservation retirement and unrelated-work completion.
- Keep preparation peak separate from consumer lifetime peak. Consumer scope
  includes loading and fixture setup; it excludes separate encoding. Do not make
  a before/after performance claim against older in-profile generation numbers.
  Preserve strict over-budget refusals and retained proof only after exact review.
