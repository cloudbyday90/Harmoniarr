# WebP canvas memory

Use for WebP rewrite failures or format-aware artwork memory admission. Read
active-repo docs/WEBP_CANVAS_MEMORY_DESIGN.md, research and outcome, plus
[prepared boundary inputs](artwork-admitted-boundary.md).

- Identify the failing phase with bounded private diagnostics. Keep the public
  protocol and opaque errors unchanged. A minimal decode, file-output rewrite
  and statistics probe are separate controls; success of one does not qualify
  their production composition.
- Retrieve the installed vendor version's source through MCP. libvips 8.18.7
  WebP loading retains an RGBA canvas even when metadata exposes RGB. Account
  for it in the shared child/parent estimate. Do not infer native allocations
  solely from visible channels or treat an estimate as an RSS ceiling.
- Separate observed failure/message/exit from inferred allocation identity or
  denying limit. A matching allocation size is not a stack or syscall trace.
  File output does not imply streaming decode/encode or remove internal writers.
- Use numeric admission before grant, rewrite and statistics. Never classify
  arbitrary vendor error text as capacity or increase limits to make a fixture
  pass. Preserve DATA, heap, deadlines, byte/pixel/output and aggregate controls
  unless a separately justified change is in scope.
- The canonical boundary entry is
  `validate:native-deployment-review-artwork-boundary`; the former admitted
  command and WebP selector are compatibility aliases. Fixed descriptors declare
  expected admission. Keep the same input bytes/SHA across fresh 2/3 GiB mixed
  profiles. JPEG must publish; the selected large WebP must return only the
  memory frame with normal exit 1, no signal and no output/publication. Abort
  containment cannot pass this entry.
- Qualify a real medium WebP rewrite with metadata removal, exact grant metadata
  and child retirement. Keep worker lifecycle/allocation/corpus regressions in
  their guarded profiles. Native allocation and encoding stay outside the fast
  gate; do not rerun unchanged SQL/browser/provider matrices without cause.
- Preserve actual review/media completion, overlap, zero final reservations,
  lease/child/container retirement and unchanged kernel counters. cgroup v1
  usage is approximate; unavailable v2 OOM counters are not zero. Lifecycle
  overlap does not establish simultaneous resource peaks or a minimum budget.
- Apply OWASP processor/resource containment, IETF truthful result handling and
  W3C accessible status ownership at their relevant boundaries. Native evidence
  alone does not establish UI accessibility or justify automatic retry.
