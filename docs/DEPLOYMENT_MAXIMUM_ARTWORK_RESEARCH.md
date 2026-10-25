# Maximum artwork research and recommendations

Reviewed October 24, 2026 through MCP search/open/navigation, with installed Sharp
0.35.5, libvips 8.18.7 and Node 24.22.1 behavior checked locally. Recommendations
are scoped engineering decisions, not a claim of comprehensive standards compliance.

| Official practice | Application and tradeoff |
| --- | --- |
| [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/) supports TIFF paths, sequential access and explicit pixel bounds. | Generate row-streamed TIFF and encode from its path. Avoid a full raw JavaScript bitmap; native codec allocations remain separate. Do not disable untrusted-input checks. |
| [Sharp global properties](https://sharp.pixelplumbing.com/api-utility/) exposes cache and per-image concurrency controls. | Limit fixture generation to one libvips thread with cache disabled, then restore prior preferences. This reduces fixture variability but does not bound all codec threads/allocations. |
| [Sharp security](https://sharp.pixelplumbing.com/security/) recommends control groups for runtime resources. | Retain container controls and isolated native worker lifetime. A contained abort is diagnostic evidence, not proof of correct processing or a known memory cause. |
| [Sharp output options](https://sharp.pixelplumbing.com/api-output/) documents format-specific encoders and default metadata removal. | Keep current rewrite settings and verify resulting metadata/format. Maximum resolution, source bytes, encoder complexity and successful output are different constraints. |
| [Node streams](https://nodejs.org/download/release/v24.20.0/docs/api/stream.html) describes backpressure and stream thresholds. | Use pipeline and lazy rows with explicit thresholds, abort propagation and owned cleanup. A high-water mark is a buffering threshold, not a whole-process memory guarantee. This is a Node 24 API reference, not the exact installed patch manual. |
| [Linux cgroup v1 memory documentation](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html) describes approximate usage accounting. | Label the actual host's v1 values honestly; retain failcnt/OOM-kill comparisons and null unavailable v2 fields. The document itself cautions that parts are outdated; observed controls are the qualification authority. |
| [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) covers bounded, sanitized evidence and sensitive-data exclusion. | Persist numeric counts, bounded error codes and child outcomes. Keep actual paths, keys, request bodies and raw native diagnostics out of public outcome documents. |
| [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) explains assistive-technology status announcements. | Retain existing checking/queued status behavior. Actual HTTP completion here does not establish rendered announcements or human assistive-technology acceptance. No UI change is required by this fixture. |

## Options

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Existing single-app admission and native isolation, with explicit maximum-case evidence | Exercises actual composition; preserves current controls and command authority | Selected inputs only; can expose contained failures. Recommended for this round. |
| Raise DATA, container memory or deadlines to force maximum-image success | Might admit more complex images | Changes the supported resource envelope without adequate evidence; do not adopt from these measurements. |
| Tighten pre-decode accounting or change codec processing after diagnosing the native abort | Could replace opaque native failure with deliberate refusal or successful bounded processing | Needs stage-specific native evidence, supported-size regressions and revised resource estimates; next implementation candidate. |
| Add an external image service | Separate resource envelope | Adds deployment, transport and ownership complexity; unnecessary for this built-in qualification. |
| Put maximum encodes into every fast run | Broad repeated execution | Expensive native allocation with little signal for unrelated edits; retain an explicit opt-in lane. |

## Recommended stack

1. Keep built-in service/admission ownership, existing byte/pixel/deadline/DATA
   bounds and container controls.
2. Generate deterministic supported-format inputs with bounded JavaScript streams;
   verify actual metadata and remove owned raw sources before application work.
3. Record publication, admission refusal, controlled processing failure and native
   abort containment separately; require strict cleanup and unrelated-work success.
4. Use fresh native profiles plus one stable fast gate and exact retention evidence.
5. Diagnose the JPEG abort boundary before changing production headroom or claiming
   a minimum deployment size. Then rerun this maximum lane as the regression proof.
