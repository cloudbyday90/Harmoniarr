# Transcode orchestration: official research

Consulted October 11, 2026 through MCP search and previously verified primary
URLs. Local Node is 24.18.1 and npm 12.0.2. This is evidence within the requested
October window, not an assumption about later publications. Ownership architecture
is a project inference from source and these contracts.

| Official source / status | Applicable practice |
| --- | --- |
| [FFmpeg formats: null muxer](https://www.ffmpeg.org/ffmpeg-formats.html), upstream documentation | The null muxer discards output rather than producing an output file. Preserve the current preflight-only boundary; this change grants no file mutation authority. |
| [Node 24.18.1 child processes](https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html), runtime documentation | Process exit precedes possible remaining stdio work. Keep the existing command owner and shell-free argv; test normal close through preflight. |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html), runtime documentation | Scheduled timer cancellation and admitted asynchronous renewal drainage are separate boundaries. |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html), language specification | Observe returned work and explicitly preserve original failure through cleanup. |
| [node-postgres pooling](https://node-postgres.com/features/pooling), driver guidance | Returned clients and pool shutdown have independent lifetimes. Drain known worker finalizers before pool/environment/workspace disposal. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Use monotonic elapsed spans for observations, labeling the source as draft. Native validation timings do not establish browser conformance or a matched speedup. |

## Recommendation and tradeoffs

Use durable operation/lease guards, small ESM task and ordered-drain services,
returned completion, awaited preflight, renewal-before-release cleanup and native
resource validation. This prevents known cleanup overlap with little duplicated
policy. Its cost is waiting for actual dependencies; hidden descendants and other
workers still need explicit owners. Extra sleeps and discarded asynchronous errors
cannot establish completion. Forced cancellation and writing transformed files
need separate ownership/consent/recovery designs.

No UI or HTTP mutation changes here, so new WCAG/ARIA browser validation is not
applicable. Existing standards-skill authority, diagnostic and browser workflows
remain available for work that touches those boundaries. Preserve existing bounded
command errors and diagnostics; no raw process output is added to public records.
