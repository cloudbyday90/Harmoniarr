# Artwork corpus in the mixed deployment workload

October 24, 2026. Implements the entropy/sample-depth follow-up from the
[mixed review outcome](DEPLOYMENT_REVIEW_MEMORY_OUTCOME.md). Reuse the existing
[seven-case corpus](ARTWORK_CORPUS_DESIGN.md) and single-app resource owners.

## Structure

Extract the existing mixed-review qualification body into one ESM helper used by
the baseline and new corpus entry. Separate owned case selection/input/output
verification from publication/refusal settlement. The shared artwork workload
accepts an optional corpus selector; omitted selectors preserve its ordinary,
maximum-pixel and maximum-byte paths. Serve each actual image with its correct
fixture MIME type, including WebP.

No production decoder, admission, limit, route, schema, dependency or UI changes.
The explicit new npm alias remains outside the fast gate. Native entries require
the existing disposable cgroup profile before pool acquisition. The corpus entry
also rejects a missing/foreign selector before generating input or acquiring a pool.

| Fixed input | Accepted behavior |
| --- | --- |
| RGB8 / RGBA8 1024² PNG noise | Canonical eight-bit pixels, dimensions/alpha and stored/source hashes |
| Grayscale16 / RGBA16 1024² PNG noise | Existing eight-bit rewrite, canonical decoded eight-bit pixels; no claim of retained 16-bit precision |
| 1024² JPEG noise with synthetic EXIF | Existing JPEG rewrite and metadata removal |
| 512² WebP noise | Existing WebP rewrite and dimensions/alpha checks |
| 8192² RGBA16 PNG pattern | Owned memory refusal, no publication lookup/assets/files/assignments, normal child retirement |

The large refusal case never decodes raw pixels in the parent. Only accepted small
PNG cases compare raw canonical projections. Deterministic noise establishes the
selected incompressible input samples, not arbitrary malformed-image complexity.

## Preserve the mixed workload

Each case retains two actual TLS downloads/ingestion jobs, 256 MiB caller bytes,
two PostgreSQL sorts, real 64-file scan/tag work, four probes, null-output encoding,
review navigation and three owned restart claims. Require completed detail/native
lifetime overlap, successful review/media completion, original source hashes,
exact lease release, reservation settlement and actual child close.

Accepted artwork retains the real held-publication checkpoint. Refusal instead
drains both jobs and asserts each returns `artwork_worker_memory` 503. It cannot
wait on a successful publication gate or convert a partial success into refusal.
No expected error waives downstream review/media, cleanup or kernel-counter checks.

Run **one corpus case in each fresh container** for each 2/3 GiB profile: fourteen
final containers/cases. This avoids accumulated lifetime peaks, bootstrap state
and cross-case asset cache hits. Different inputs may legitimately produce equal
canonical output hashes; source checksums remain specific to each fresh case.
Keep the established two-CPU/256-PID/read-only/no-network/tmpfs controls.

Rerun the three existing default memory cases and baseline mixed-review case on
the changed shared helpers. Keep those regression results separate from the
fourteen isolated corpus measurements. Retain unrelated SQL/browser/provider proof
only after exact source/test/packaged-runtime comparison.

## Reproduce and interpret

Use the container controls/source mounts from
[the mixed design](DEPLOYMENT_REVIEW_MEMORY_DESIGN.md), mount the new native entry
read-only, and set `HARMONIARR_REVIEW_ARTWORK_CASE` to one exact id from
`testing/server/artwork-corpus-inputs.js`. In that disposable container invoke:

```text
npm run validate:native-deployment-review-artwork-corpus
```

Repeat with fresh storage/container for every case and profile. Memory current,
lifetime peak, process fields, logical reservations and operation durations retain
their separate meanings. Kernel peak includes setup/generation; v1 usage remains
approximate. This selected corpus does not establish a production minimum or a
worst-case decoder/household concurrency bound. Record actual results in the
separate [outcome](DEPLOYMENT_REVIEW_CORPUS_OUTCOME.md).
