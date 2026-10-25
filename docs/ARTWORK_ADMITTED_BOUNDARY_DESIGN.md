# Admitted artwork boundary design

October 24, 2026. Implements the next qualification item from
[rewrite headroom](ARTWORK_REWRITE_HEADROOM_OUTCOME.md). See separate
[research](ARTWORK_ADMITTED_BOUNDARY_RESEARCH.md) and
[outcome](ARTWORK_ADMITTED_BOUNDARY_OUTCOME.md).

## Inputs and ownership

Use fixed 8192² RGB8 noisy-source JPEG quality 24 and WebP quality 3. Their actual
encoded sizes are 14,154,530 and 14,127,228 bytes, respectively, below the 14 MiB
example in the shared child estimate. Neither is padded. Lossy encoding changes
the decoded noise distribution; this is a selected stress corpus, not a universal
entropy or complexity envelope.

Prepare the files once on the pinned Linux image with bounded row-streamed TIFF,
cache disabled and encoder concurrency one. Remove the owned raw source and
restore prior preferences. Pin exact encoded bytes and SHA-256 in frozen case
descriptors. Keep preparation evidence separate from application profile metrics.
No large binary is checked into Git.

Native profiles require an explicit read-only `/boundary-inputs` bind. The loader
accepts only the fixed descriptors, regular files with exact sizes, bounded reads
through an owned file handle, EOF and the pinned digest. Reject missing, truncated,
changed, oversized or substituted inputs; never regenerate or silently fall back
inside the profile. A digest supplied alongside arbitrary content is not authority.

Preparation creates a fresh output directory and never overwrites a prior one.
It records encoder versions and input metadata, making dependency drift explicit.
Files are synthetic public test material and have no live provider credentials.

## Actual workload and result boundary

Reuse the existing single-app TLS/artwork/PostgreSQL/review/media workload, child
admission, deadlines and allocation controls. The selected inputs must pass the
shared metadata estimate before processing. Keep the maximum-fixture scan tag gate
through actual artwork spawn, unchanged encoder behavior and cleanup drainage.

Verify successful source/output hashes, format/dimensions, metadata removal,
owner assignments and complete artifact inventory. Owned processing/time/output
refusal remains distinct from success. Require actual child close, zero final
reservations, released leases, media source preservation, successful unrelated
work and unchanged kernel limit/OOM counters. A native abort is a failed admitted
qualification, not a graceful refusal.

Run one case per fresh 2/3 GiB profile. Preparation cost/peak is reported separately;
the application profile includes input loading and the existing fixture setup.
This deliberately differs from older per-profile generation measurements. Do not
compare those peaks as a processing speedup or derive a deployment minimum.

## Validation

Keep cheap descriptor/pinning/read-bound/ownership checks in the fast gate and
native codecs opt-in. Run the affected existing selector/observer/drain cohorts,
default deployment-memory and baseline mixed regressions. Retain unrelated proof
only through exact relevant source and packaged-runtime comparison. Any observed
native defect needs a separate evidence-backed implementation decision. Preserve
failed candidates and do not raise limits to obtain a pass.
