# Wanted fixture seed research, October 2026

Consulted October 13, 2026. MCP web search discovered primary URLs; MCP opening
and official W3C navigation verified their contents/status. GitHub MCP search
and repository metadata supplied the PR collection. An initial MCP transport
failure was followed by successful discovery; no link was fabricated.

| Official source/status | Applied practice | Pros | Cons or limits |
| --- | --- | --- | --- |
| [W3C High Resolution Time, September 1, 2026 Working Draft](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/) | Monotonic durations within one execution. | Stable phase measurements. | Draft, not a Recommendation or Node/application certification. |
| [Node 24 performance APIs](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html), runtime documentation | Use the existing `performance.now()` family; distinguish nested/outer scopes. | Same timing basis as workload samples. | Opened patch 24.21.0 differs from host 24.18.1; no new patch-specific API or runtime upgrade. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Fixed approved phases, opaque numeric spans and safe outcomes; no private payloads. | Useful diagnosis with minimized data. | Labels locate operations, not root cause; sink failure cannot replace original work. |
| [FFmpeg command documentation](https://www.ffmpeg.org/ffmpeg.html), maintainer documentation | Preserve per-output metadata and explicit command boundaries when considering media batching/remux. | Avoid repeated encoding where equivalent media can be independently proved. | Current docs are not the host tool version (verified local 8.0.1); batching is a deferred candidate, not implemented from documentation alone. |
| [Node 24 ESM](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html), runtime documentation | Load benchmark modules with dynamic imports after command refusal checks. | Avoid app loading for invalid/missing-GC invocations. | Preserve exact module selection and ESM specifiers; this does not reduce real app execution work. |
| [Docker exec](https://docs.docker.com/reference/cli/docker/container/exec) and [none networking](https://docs.docker.com/engine/network/drivers/none/), platform documentation | A future scenario-owned media executor can run commands in an acknowledged isolated container. | Candidate reduction in per-command startup. | Requires new process/lifetime and read-only mount proof; not implemented or certified here. |

These project choices are inferences from the guidance and the actual fixture
owners. No source requires caching media inspection or deleting a final guard.

## Alternatives and final recommendation

1. Add nested seed diagnostics first. Pros: locates returned work and counts
   actual inspection/generation commands; cons: small observation/serialization
   overhead. Recommend before optimization.
2. Replace the preparatory preview with evidence from the actual worker preview.
   Pros: removes one redundant inspection per requested file while retaining the
   current canonical plan; cons: requires native plan/receipt proof and helper
   caller regression. Promote only after executed evidence.
3. Batch media generation or reuse prepared encoded input. Pros: potentially
   fewer processes/encodes; cons: metadata, independent physical files, ownership
   and exact fixture-shape proof. Defer until measured.
4. Enlarge deadlines/pools or bypass apply verification. Pros: may complete more
   runs; cons: masks cost and changes correctness/resource contracts. Reject here.

Final stack is phase evidence, one actual preview owner and unchanged canonical
verification. Keep full versus selected collection explicit. Browser/assistive
technology checks do not apply to this fixture-only slice; no general security
or WCAG conformance claim follows. See the [design](WANTED_SEED_PHASE_DESIGN.md)
and [outcome](WANTED_SEED_PHASE_OUTCOME.md).
