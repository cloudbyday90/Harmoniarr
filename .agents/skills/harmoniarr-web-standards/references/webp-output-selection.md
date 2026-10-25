# Bounded WebP output selection

Read active-repo docs/WEBP_OUTPUT_SELECTION_DESIGN.md, research and outcome.

- Select only decoder-confirmed small opaque sRGB lossless layouts. Structural
  facts do not replace full native decode/rewrite; unsupported content keeps the
  baseline path. Keep geometry/byte caps and parser/protocol negative controls.
- Both encodes share one monotonic acceptance budget, with native timeouts bounded
  by remaining whole seconds and pre/post elapsed checks. The parent's whole-job
  deadline and actual-close ownership still fence native/queue non-cooperation.
- The selection metadata field may increase/retain reservation, never lower it.
  Validate its exact boolean, geometry and actual input-byte bound before grant.
  Hold the full initial DATA-based reservation through close and publication;
  both retained outputs and the sequential native set belong to that envelope.
- Require both encodes to succeed, cap each output and compare real sizes. Prefer
  lossless ties; no native-failure fallback or source passthrough. Do not estimate
  a combined pipeline by adding isolated peaks or reusing lossy-only accounting.
- Pair focused service/admission/protocol tests and one stable fast gate with
  actual PostgreSQL/file publication and native-active cancellation in guarded
  2/3 GiB profiles. Verify queue serialization, source/selected hashes, no alternate
  files, metadata/pixels, child absence and final zero reservation. Re-run affected
  worker/mixed controls; retain unrelated proof only after exact source/runtime review.
