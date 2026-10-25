# WebP effort comparison

Use for encoder effort/quality experiments. Read active-repo
docs/WEBP_EFFORT_COMPARISON_DESIGN.md, research and outcome.

For a representative artwork screen, also read active-repo
docs/WEBP_ARTWORK_CORPUS_DESIGN.md, research and outcome. Pin original provenance
and lossless prepared inputs before comparing. Keep a fixed content-class scope,
counterbalanced three-repeat schedule and predeclared engineering thresholds.
Separate numerical screening, agent inspection and human visual acceptance; none
of these alone grants a production switch. Preserve failed criteria and cases.

- Reuse pinned bytes; predeclare scope, crop geometry, settings and equal limits.
  Never adjust caps or input to obtain a successful reference. Keep production
  admission active; a test-only encoder probe cannot qualify app publication.
- Reuse production framing, deadlines and actual-close ownership. Allowlist
  effort/scope arguments, bound numeric diagnostics and keep file-write authority
  in the parent. Failed encoding must leave no output artifact.
- Run each encoder case in a fresh constrained container on the exact packaged
  runtime, including verified temporary-filesystem capacity. A smaller tmpfs can
  fail lazy decode before encoding; preserve that invalid attempt and never
  interpret it as encoder quality/capacity evidence. Separate rewrite pipeline,
  transfer, container peak and pixel-metric measurements.
  Verify metadata stripping, output bytes/hash, child and container retirement.
- Compare decoded input RGB8 explicitly: already-lossy input is not the raw-source
  reference. Equal quality settings do not imply equal quality. RGB PSNR/MSE are
  diagnostic, not perceptual acceptance; mark identical/infinite PSNR JSON safely.
- A failed full-size method has no full-size paired quality/size result. A fixed
  crop supports only that sample, not full-size or natural-artwork acceptance.
  Require representative paired outputs and visual review before a global switch.
- Keep native comparisons opt-in. Run arithmetic/selector and affected existing
  worker tests, then one stable fast gate. Retain unrelated proof only after exact
  source/test/runtime comparison; do not count retained checks as new executions.
