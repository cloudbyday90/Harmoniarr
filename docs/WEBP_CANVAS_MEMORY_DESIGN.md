# WebP decoder canvas memory design

October 25, 2026. Follows the controlled-failure investigation from the
[admitted boundary outcome](ARTWORK_ADMITTED_BOUNDARY_OUTCOME.md). See separate
[research](WEBP_CANVAS_MEMORY_RESEARCH.md) and [outcome](WEBP_CANVAS_MEMORY_OUTCOME.md).

## Evidence and decision

Minimal private markers reproduce input and metadata completion followed by a
rewrite failure requesting 256 MiB; statistics do not start. Under the same 1 GiB
DATA/128 MiB old-space limits, a minimal decode probe and a statistics-only probe
succeed. File-backed rewrite fails with the same allocation message. These are
separate controls, not evidence that the complete production composition succeeds.

Pinned libvips 8.18.7 WebP loading uses an eight-bit four-band memory canvas even
when output metadata reports three RGB bands. At 8192² that canvas costs 256 MiB.
The writer also retains a contiguous frame and a memory writer for file targets.
The observed allocation matches the canvas size; without an allocation stack or
syscall trace, its exact call site and denying constraint remain an inference.

Add a distinct `artworkDecoderCanvasBytes` component to the shared child estimate:
four bytes per input pixel for WebP, zero for other accepted formats. This models
a known whole-frame cost in addition to existing conservative working allowances.
It is a planning estimate, not an allocator/RSS guarantee. Both the child guard
and parent metadata reservation continue using one shared estimate.

After inspecting the header, the known 8192² RGB WebP fixture now returns owned
`artwork_worker_memory` 503 before the metadata/grant handshake, rewrite or
statistics. The JPEG estimate
does not change. DATA, heap, deadlines, aggregate budget, input/output policies,
encoder settings and production protocol remain unchanged. No native-message
matching, diagnostics exposure, new service or temporary-output authority is added.

## Qualification structure

Name the canonical native entry for boundary cases rather than assuming all are
admitted. Give fixed descriptors explicit expected admission; retain input byte/
digest pins. Rename the WebP case to describe canvas refusal. Keep the previous
npm command as an alias to the canonical entry, without a second implementation.
Historical results remain historical evidence and are linked to the new outcome.

Require the actual 21-byte memory-failure frame and normal exit 1/no signal for
the selected WebP refusal, with no publication/assignment/file. JPEG retains real
output/hash/metadata checks. Continue successful unrelated review/media work,
actual close, reservation/lease retirement and unchanged kernel counters.

Add a real 4096² WebP success control with synthetic EXIF, rewritten metadata
removal and actual worker retirement. Keep existing lifecycle, allocation and
seven-case corpus regressions in their original constrained profiles. Unit checks
cover alpha-independent canvas cost, unchanged JPEG math and refusal before grant.
Code remains modular ESM; expensive native work stays outside the fast gate.

Use pinned prepared bytes across fresh 2/3 GiB mixed profiles. Retain unrelated
SQL/browser/provider evidence only after exact affected/unaffected source and
runtime comparison. Rebuild the preserved-state walkthrough without cache and
create no release or branch.
