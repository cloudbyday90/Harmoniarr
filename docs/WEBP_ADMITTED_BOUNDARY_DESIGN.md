# Noisy WebP admitted-boundary design

October 25, 2026. Continues the [canvas outcome](WEBP_CANVAS_MEMORY_OUTCOME.md).
See separate [research](WEBP_ADMITTED_BOUNDARY_RESEARCH.md) and
[outcome](WEBP_ADMITTED_BOUNDARY_OUTCOME.md).

## Fixed candidate and decision

Before any processing outcome, select 7120 × 7120 RGB8, fixed-seed row-streamed
TIFF source, WebP quality 3/effort 4, plus synthetic EXIF Artist metadata. Dimensions
are a multiple of sixteen. The previous fixed WebP's encoded-byte/pixel ratio and
the current shared estimate predict a few MiB of headroom. Require positive
headroom below 4 MiB after encoding; do not search dimensions, quality or padding
until processing succeeds. If the candidate misses that band or fails processing,
preserve and report the failed qualification.

This is lossy noisy-source content, not an incompressible bitmap or arbitrary
WebP acceptance guarantee. Pin exact size/SHA in the fixed descriptor before
consuming it. Use a separate bounded preparer on the pinned Linux runtime; keep
raw-file retirement and Sharp cache/concurrency restoration. Reproduce once with
the maintained preparer, then reuse its bytes across fresh read-only consumers.
Initial generation only discovers the pin, without exercising the production
worker. Preparation costs stay outside application measurements.

## Structure and verification

Extend the existing fixed boundary catalog with explicit per-case geometry and
headroom bounds. Add a single-case selector to preparation to avoid regenerating
unaffected artifacts. Group default preparation by geometry so it retains the
existing source sharing and supports the new dimensions. Reject unknown selectors
before creating output, preserve existing byte pins, and never replace an output
directory. Keep preparation separate from measured consumption.

Use the existing canonical boundary native entry. Assert numeric admission and
the declared headroom before acquiring PostgreSQL. The admitted case must publish
both sanitized images/assignments with matching saved input/output hashes, correct
format/dimensions, removed EXIF/ICC/XMP and complete artifact inventory. Require
normal worker exits, actual close, zero final reservations, released leases,
successful unrelated work and unchanged available kernel counters. A contained
abort or owned processing refusal fails this admitted-success qualification.

The fixed candidate fails that strict publication check: both workers return an
owned failed result. Keep the assertion and failed evidence. Provide a separate
opt-in characterization entry using the same guarded profile and workload. Its
diagnostic explicitly records `processingQualified`, and a passing containment
check is not a passing publication qualification. No native abort, signal-based
timeout or unowned error can pass characterization. Do not alter the fixture or
resource/encoder contract in response to the observed failure.

Run fresh 2/3 GiB mixed profiles, retaining the actual review/media workload and
no new runtime limits or services. Check the existing JPEG success and large WebP
pre-grant refusal through the same changed entry. Cheap selector/headroom/read/
cleanup regressions precede one stable fast gate. Native codecs remain opt-in.
Retain unrelated SQL/browser/provider and native proof only after exact relevant
source, driver and packaged-runtime review.

Rebuild the preserved-state walkthrough without cache. Work on main, preserve
administrator/data/mounts, commit and push, and create no release or branch.
