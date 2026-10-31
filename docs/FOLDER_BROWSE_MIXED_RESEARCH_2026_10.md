# Mixed-file first-page research

Consulted October 31, 2026 through MCP search and opened official sources.
This addresses the variable mixed/first-page Windows-bind result in the
[buffer comparison](FOLDER_BROWSE_BUFFERS_OUTCOME.md). See the separate
[design](FOLDER_BROWSE_MIXED_DESIGN.md) and [outcome](FOLDER_BROWSE_MIXED_OUTCOME.md).

| Official source and status | Applied practice |
| --- | --- |
| [NIST randomized block designs](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm?trk=article-ssr-frontend-pulse_little-text-block), statistical handbook | Group related observations and randomize within practical constraints to reduce nuisance effects. Our balanced adjacent-pair schedule applies this principle; it is not a claim that host load/cache effects have been eliminated. |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html), served as 24.22.2 | Larger opendir buffers trade memory for performance. The measured immutable runtime remains 24.22.1; no runtime upgrade or production buffer change is part of this experiment. |
| [W3C High Resolution Time, September 1, 2026](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), Working Draft | Measure durations with monotonic clocks. Applying the principle through Node performance.now is an application inference, not browser conformance or Recommendation status. |
| [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints), implementation guidance | Match CPU/memory resources and equal memory/memory-swap limits. Verify actual configured/kernel bounds rather than using host free output as a container limit. |

## Alternatives and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Repeat the original four observations | Minimal tooling | Too little information about ordering, observer state or variation between blocks. Insufficient. |
| Fixed first-page blocks with balanced randomized order | More pairs, exact recorded schedule, adjacent comparison, explicit controls | More fresh consumers; storage caches and external activity remain shared. Selected. |
| Discard slow observations | Cleaner-looking results | Hides the uncertainty this task investigates. Rejected. |
| Add per-entry timing/Promise probes | Finer attribution | Changes observer cost on every directory entry and can distort the comparison. Deferred. |
| Promote buffer 128 from the previous ceiling medians | Immediate potential throughput gain | Mixed first-page behavior and aggregate memory remain unqualified. Deferred. |

## Recommendation stack

Keep the guarded built-in scanner and production buffer 32. Extend the explicit
ESM measurement lane with one fixed mixed-first-page bind experiment: four blocks,
four pairs per observer state per block, both buffers, fresh consumers and the
same 1,000-directory/9,000-file fixture. Balance buffer-first and observer-first
positions, randomize their permutations and retain the exact plan in the report.

Use existing identity/resource/retirement guards and native Promise-preserving
counters. Report all samples, per-block and paired distributions, order strata,
CPU/load/kernel facts and separate memory scopes. Preserve refusals as refusals;
do not infer significance, causation, universal speedup or an automatic default
from pooled medians. Keep the lane opt-in and clean up its owned resources.

The [measured outcome](FOLDER_BROWSE_MIXED_OUTCOME.md) did not repeat the previous
median slowdown. It advances 128 to four-scan aggregate qualification while
retaining production 32; it does not attribute the earlier variance to a cause.
