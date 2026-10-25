# WebP lossless rewrite design

October 25, 2026. Continues the [artwork corpus finding](WEBP_ARTWORK_CORPUS_OUTCOME.md).
See separate [research](WEBP_LOSSLESS_REWRITE_RESEARCH.md) and
[outcome](WEBP_LOSSLESS_REWRITE_OUTCOME.md).

## Fixed qualification

Reuse the four prepared RGB8 WebP inputs and their committed pins. Compare the
current lossy quality-90/effort-4 rewrite with an explicit lossless quality-90/
effort-4 rewrite. In lossless mode the quality setting controls compression
effort, not pixel loss. Do not regenerate inputs, resize, tune settings or raise
limits to obtain a result. Both paths decode, rotate and re-encode; no input-byte
passthrough, metadata preservation, automatic retry or production selection rule.

Use three alternating-order repetitions per mode/sample, each in a fresh isolated
3 GiB/two-CPU/96-PID container with 256 MiB tmpfs. Retain 1 GiB child DATA, 128 MiB
old-space, ten-second rewrite and fifteen-second outer deadline. Reuse existing
framing and actual-close ownership. Keep output writes in the parent, after close.

Predeclare the following per-sample engineering screen, not a global policy:

- All repetitions encode, retain dimensions/opaque RGB8 and stable output hashes.
- Candidate decoded RGB8 equals the prepared input byte for byte. Compare pixels
  in a separate constrained container, outside encoder timing and memory.
- Native decoder inspection and bounded container facts agree on lossless input/
  output geometry; output strips EXIF, XMP and ICC. Structural facts alone never
  establish decodability or permission to bypass sanitization.
- Lossless output is no larger than the paired current lossy output, and median
  rewrite time is at most one second for these modest, at-most-1024-pixel inputs.
  This latency choice is a project screen, not a standards requirement or SLA.
- Record original full/crop regressions and a corpus effort-2 control separately.
  Missing references, timeouts, nondeterminism and failed criteria remain visible.

The container-fact reader is a testing utility for a narrow still-lossless layout:
bounded RIFF length/chunk traversal, zero padding, unique supported chunks, VP8L
signature/version/geometry and consistent VP8X metadata flags. Decline animation,
alpha, lossy/ambiguous layouts and unknown chunks rather than guessing. Do not
turn this narrow experimental inspector into a general production WebP validator.

## Implementation and result ownership

Keep immutable rewrite modes/schedule, structural facts and numerical evaluation
in small ESM testing modules. Extend the existing comparison worker/entry with an
allowlisted mode; preserve legacy lossy invocations and production runtime code.
Reuse the corpus's provenance/pinned reader and keep codecs opt-in. A passing
sample does not grant a global production switch, mixed-workload admission or
publication qualification. Report photographic tradeoffs alongside graphic wins.

Use focused parser/selector/policy and existing worker tests, one stable fast gate,
fresh paired native runs and exact retained-evidence review. Rebuild the walkthrough
without cache, preserving administrator/data and five actual binds. Work on main,
commit/push all project changes, and create no branch or release.

## Reproduction

Reuse the corpus's prepared `inputs/` directory read-only; the committed catalog
supplies byte counts/digests, not an external manifest. Follow the constrained
Docker invocation in the [original comparison design](WEBP_EFFORT_COMPARISON_DESIGN.md).
The native entry remains `test/native/artwork-webp-effort.test.js` and its optional
mode environment variable is `HARMONIARR_WEBP_COMPARISON_MODE=lossy` or `lossless`.
Omission keeps the original lossy behavior. Lossless accepts only effort 4 and one
of the four registered corpus scopes, never arbitrary encoder options or paths.

Run the 24 frozen entries exported as `webpLosslessSchedule` with fresh output
directories/containers. Preserve the original full/crop cases and effort-2 graphic
control separately. Each `result.json` records actual close, byte/hash observations
and, for lossless, bounded input/output container facts. A passing native check
means a correctly recorded outcome; inspect it for actual encode success/failure.

In a separate constrained container, pin the prepared input, verify each artifact
against its recorded digest, decode RGB8 and run `measureRgb8Error`. Feed the
complete observations plus metrics to `evaluateWebpLosslessRewrite`. Preserve
failed samples and exact-byte/metadata evidence. Do not include pixel-comparison
allocations in the encoder's time/peak or substitute a checksum match for actual
decoded-pixel equality.
