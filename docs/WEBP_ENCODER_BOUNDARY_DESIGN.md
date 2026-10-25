# WebP encoder failure boundary design

October 25, 2026. Continues the fixed [admitted candidate](WEBP_ADMITTED_BOUNDARY_OUTCOME.md).
See separate [research](WEBP_ENCODER_BOUNDARY_RESEARCH.md) and
[outcome](WEBP_ENCODER_BOUNDARY_OUTCOME.md).

Trace the same pinned 7120² WebP without changing pixels, quality, input/output
policy, DATA/heap, encoder settings or production deadlines. Observe native error
codes and failed allocation/syscall boundaries before changing admission. Keep
debugger overhead separate from production resource measurements.

Use a disposable diagnostic image with GDB/strace, no application data, no network
at execution and bounded resources/evidence. Compare existing runtime packages,
Node/native binaries and dependencies to the unmodified image; additions are
diagnostic tools only. No tool, tracing capability, native patch, debug setting
or diagnostic text is deployed with the application. Runtime code stays ESM.

Require actual child/container retirement and unchanged available kernel counters.
Record instrumentation and inference limits. A native encoder error enum is more
specific than generic vendor text; an ENOMEM alone does not identify a unique
limit without the surrounding limit/mapping evidence. Never match vendor strings
in production or raise resource caps to obtain a pass.

If the evidence supports a production change, put format-specific accounting in
the existing shared child/parent estimate, test pre-grant refusal and successful
smaller-image behavior, and qualify affected native/mixed profiles. Preserve the
failed candidate as evidence. If evidence is insufficient, retain the strict
publication failure and implement only the supported diagnostic/validation work.

## Selected implementation

The corrected instrumented run observes a token-page allocation failure followed
by encoder return 0/error enum 1. The 7120² case has 445 × 445 macroblocks. At
quality 90, one page holds 4,356,550 two-byte tokens plus an eight-byte next pointer:
8,713,108 bytes. Reserve that source-derived growth unit plus 64 KiB allocator
slack in the shared estimate. The slack is an explicit planning choice, not a
measured universal allocator bound. Page count is content-dependent; one growth
unit does not bound the accumulated pages or guarantee all admitted work succeeds.

Keep quality 90/effort 4 in a small shared WebP policy module used by processing
and accounting. Both child admission and parent metadata reservation use the same
estimate. The pinned 7120² input now exceeds DATA by 6,572,632 bytes and refuses
before metadata/grant, rewrite or stats. Preserve exact pixels, bytes/hash, output
policy, limits and deadlines. Rename its canonical descriptor to token refusal,
retaining the historical CLI selector as an alias. Prior failed-publication
results remain historical evidence; this change qualifies refusal, not encoding.

Test macroblock/minimum-page rounding, exact numeric admission, parent accounting
and pre-grant order, then fresh 2/3 GiB boundary/mixed profiles and affected native
worker/allocation/corpus/medium-WebP controls. Reuse prepared artifacts; no new
encoding preparation is needed. Keep all decoder/debugger artifacts outside Git.

Use focused regressions and one stable fast gate. Retain unrelated proof only
after exact source/driver/runtime comparison. Rebuild the preserved walkthrough
without cache, keep administrator/data/mounts, work on main, commit and push all
changes, and create no release or branch.
