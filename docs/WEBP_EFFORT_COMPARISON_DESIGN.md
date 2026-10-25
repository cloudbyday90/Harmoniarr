# WebP effort comparison design

October 25, 2026. Continues the [encoder boundary outcome](WEBP_ENCODER_BOUNDARY_OUTCOME.md).
See separate [research](WEBP_EFFORT_COMPARISON_RESEARCH.md) and
[outcome](WEBP_EFFORT_COMPARISON_OUTCOME.md).

## Predeclared comparison

Compare efforts 2 and 4 at quality 90 on the same pinned 7120² RGB8 WebP, without
changing input bytes, DATA/heap, rewrite/outer deadlines or container limits.
Use a test-only encoder probe on the original packaged runtime. Production's
current admission policy remains enforced in the application; the encoder probe
does not establish application admission, publication or general WebP acceptance.

Each final encoder case uses a fresh 3 GiB/two-CPU/96-PID container, read-only root,
no network/capabilities, read-only pinned input and an explicit fresh artifact
directory. Children retain 1 GiB DATA, 128 MiB old-space, ten-second native rewrite
and fifteen-second outer deadlines. Match the existing 256 MiB temporary
filesystem and assert it before measuring. Record wall time, child peak RSS, container
lifetime peak, actual close, owned outcome, output bytes/hash and available kernel
counters. Keep failed cases and partial-output cleanup visible.

Effort 4 may fail before producing an output. Never invent a full-size paired
quality result or raise its cap to obtain a reference. For successful output,
compare decoded RGB8 pixels to the decoded input (which is already lossy).
Report RGB MSE/PSNR and maximum absolute error, not original-TIFF fidelity or
perceptual equivalence. Quality measurements run separately from encoder timing/
memory to avoid confounding those observations.

Also predeclare a 1024² center crop at left/top 3048, derived from the same input,
for paired method comparison. This is an independent quality sample, not a
replacement for full-size qualification. Do not search geometry/quality for a pass
or use noise-only crop metrics to claim natural-artwork visual acceptance.

## Implementation and decision

Keep comparison scope/policy, process ownership and pixel-error accounting in
small ESM testing modules. Validate selectors, bounded diagnostics, failure/file
ownership and actual retirement. Keep native codecs/metrics opt-in and cheap
arithmetic/protocol tests in the fast gate. No production effort switch or retry
fallback follows automatically from a comparison result.

Use official source behavior, measured results and limitations to recommend the
next step. Preserve strict application refusal unless evidence supports a separate
output-quality/capability decision. Rebuild the preserved walkthrough without
cache, retain unrelated proof only after exact source/runtime review, work on main,
commit and push all changes, and create no release or new branch.

## Repeat an encoder case

Reuse the prepared root from the [pinned artifact design](ARTWORK_ADMITTED_BOUNDARY_DESIGN.md).
The consumer verifies the selected file's exact byte count and SHA-256; it does
not regenerate the source. Run each combination of effort `2`/`4` and scope
`full`/`center-1024` in a fresh container and empty artifact directory:

```powershell
$imageId = docker inspect --format '{{.Image}}' harmoniarr-walkthrough-harmoniarr-1
$fixtureRoot = (Resolve-Path .tmp/artwork-webp-admitted-2026-10-25/inputs/reproduced).Path
$artifactRoot = (New-Item -ItemType Directory .tmp/webp-effort-repeat-full-2).FullName
docker run --rm --entrypoint node --network none --read-only --cap-drop ALL `
  --security-opt no-new-privileges:true --user 1000:1000 `
  --memory 3g --memory-swap 3g --cpus 2 --pids-limit 96 --workdir /app `
  --tmpfs /tmp:rw,nosuid,nodev,size=256m,mode=1777 `
  --env HARMONIARR_BOUNDARY_FIXTURE_ROOT=/boundary-inputs `
  --env HARMONIARR_WEBP_COMPARISON_EFFORT=2 `
  --env HARMONIARR_WEBP_COMPARISON_SCOPE=full `
  --mount "type=bind,source=$fixtureRoot,target=/boundary-inputs,readonly" `
  --mount "type=bind,source=$artifactRoot,target=/qualification" `
  --mount "type=bind,source=$PWD/src/server,target=/app/src/server,readonly" `
  --mount "type=bind,source=$PWD/src/shared,target=/app/src/shared,readonly" `
  --mount "type=bind,source=$PWD/testing/server,target=/app/testing/server,readonly" `
  --mount "type=bind,source=$PWD/test/native/artwork-webp-effort.test.js,target=/app/test/native/artwork-webp-effort.test.js,readonly" `
  $imageId --test --test-concurrency=1 test/native/artwork-webp-effort.test.js
```

Use the outcome's immutable image ID for historical replication. A passing test
means a valid recorded comparison outcome; inspect `result.json` for encoding
success or failure. Successful output is stored only after actual child close.
Measure decoded-input error with `testing/server/webp-quality-metrics.js` in a
separate constrained process, verifying each artifact against its recorded digest.
Never include pixel comparison allocations in the encoder's peak or timing.
