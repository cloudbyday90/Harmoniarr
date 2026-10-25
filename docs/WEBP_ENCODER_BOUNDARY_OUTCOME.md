# WebP encoder boundary outcome

October 25, 2026. The native failure is token-buffer growth running into DATA.
The same pinned input now receives deliberate pre-grant memory refusal. This is
an admission repair, not successful encoding of the candidate. See separate
[design](WEBP_ENCODER_BOUNDARY_DESIGN.md), [research/tradeoffs](WEBP_ENCODER_BOUNDARY_RESEARCH.md)
and [local rebuild](LOCAL_DOCKER_WEBP_ENCODER_BOUNDARY_OUTCOME.md).

## Native evidence and limits

The unchanged 7120² WebP is 10,675,042 bytes, SHA-256
`7ea1eb9d58f173027c2e3534dacac3c8c83596a438e7b062d0ce5c03122430ad`.
On the corrected diagnostic image, GDB observes encoder entry with error 0,
failure of a private writable anonymous mapping of 8,713,128 bytes, and encoder
return 0 with `VP8_ENC_ERROR_OUT_OF_MEMORY` (1). At failure, DATA is 1 GiB, AS is
unlimited, VmData is 1,046,524 KiB and mappings are 125 against a 262,144 limit.
The request exceeds remaining DATA headroom. Kernel OOM kills remain unchanged.

The binary call site and pinned source identify `TBufferNewPage`: 4,356,550 tokens,
8,713,108 requested payload bytes, 59 existing pages/514,073,372 payload bytes.
The mapping request includes allocator overhead. The source formula and captured
arguments agree. These are instrumented observations; timings/peaks are not
production measurements, and this is not a complete bound on encoder memory.

Native source: libwebp 1.6.0 commit `4fa21912338357f89e4fd51cf2368325b59e9bd9`,
encoder blob `1e7ee67c2cd8d4c739037fdb2cc9622628c6a3a2`, token blob
`9c8b8ee9c193764367ec16b6ce3df8a406292cdc`, API blob
`ed493932344d85b502072ed76f2bd92a62a84d39`. libvips writer blob is
`e061526260b1006c0ebc1c406e408d843959b675`.

Installing debug tools initially upgraded musl. Identity review caught the drift;
that initial evidence is retained as an invalid comparison. The diagnostic image
was rebuilt with original musl bytes restored. All six mapped Node/Sharp/native/
runtime library files and version information then match the unmodified image.
Its package database still carries the diagnostic musl label; actual loaded bytes
are the identity evidence. Mismatched debug symbols are rejected by GDB. No extra
capability or relaxed seccomp profile was needed; execution has no network, no
application data, read-only root, UID 1000 and bounded resources. Tools and raw
diagnostics stay local and are not deployed.

## Implemented behavior

`artwork-webp-policy.js` owns unchanged quality 90/effort 4 and one quality-derived
token growth unit plus 64 KiB planning slack. Shared child/parent accounting uses
this allowance alongside existing runtime/input/output/decoded/canvas estimates.
For the pinned candidate the allowance is 8,778,644 bytes; total estimate becomes
1,080,314,456 bytes, 6,572,632 above DATA. Refusal precedes the metadata/grant
handshake, rewrite and statistics. Opaque native-error handling stays unchanged.

The canonical selector is `rgb8-webp-7120-token-refusal`; the historical admitted
selector remains a CLI alias. Filename, pixels, byte/hash pins and synthetic EXIF
remain unchanged. The preceding failed publication checks remain historical
evidence. Characterization still applies only to numerically admitted inputs.
No image, assignment or file can publish on the new refusal. JPEG accounting and
all resource/deadline/output controls remain unchanged. Application code is ESM.

## Validation

Frozen source is 3,475 files,
`fb557266df6e87da63290932df4242ece5e1ca0e72895ba2e2f892fb7d5b7758`.
One stable fast gate passes **11,133 tests** (5,953 server, 4,480 client, 700
scripts), plus lint, ESM, schema/migration, hygiene and build checks. The focused
cohort passes 65 tests, including minimum/macroblock page sizing, exact numeric
admission, shared parent accounting, unchanged settings and refusal before grant.
Both updated skills validate.

The rebuilt normal runtime passes **29 native checks in twelve fresh containers**:
six boundary profiles, three default-memory checks, one baseline mixed check,
seven worker lifecycle checks, four allocation/reservation checks, seven corpus
checks and the medium-WebP success control. Worker lifecycle/corpus retain
1 GiB/one CPU; allocation/medium retain 3 GiB/two CPUs. Mixed cases use fresh
2/3 GiB profiles. Debuggers and diagnostic packages are absent from these runs.

Both 7120² profiles return two owned memory 503s, normal exit 1/no signal, and
only the 21-byte failure frame before metadata/grant. No images, assignments,
publication lookup or output file appear. The 8192² WebP also retains deliberate
pre-grant refusal. JPEG publishes two sanitized images/assignments under each cap,
with complete hash/metadata/inventory checks. The 4096² WebP rewrites successfully,
strips EXIF and retires its child: 29,920 output bytes with unchanged SHA-256
`8c3ff2ea21ab444421e8c69ca66c2b4930041a793dafb4b7329eea9c9fb5b33c`.

Mixed profiles complete eight actual HTTP operations, three worker qualification
steps, held database sorts, scan/tag work, probes and real FFmpeg encoding.
Actual HTTP/native lifetime overlap is observed. Children, all four captured
leases and final reservations retire. Available cgroup v1 limit/OOM-kill counters
remain unchanged; usage is approximate and unavailable v2 OOM events remain null.
Normal peaks include setup/input loading, exclude preparation/debugging, and do
not establish a deployment minimum or simultaneous component maxima.

All eighteen named diagnostic/native containers are removed and absence-checked;
identity/inventory controls, builder and bootstrap retirement have separate proof.
The three prepared inputs are reused with unchanged bytes/hash pins. The old
manifest's 7120 admitted label is historical; consumer authority comes from the
source pin, not a mutable manifest. No artifact is regenerated or tuned here.

Unrelated 42 SQL, nine browser and controlled-provider/file-backed results are
retained through exact relevant source/test and packaged-runtime review, not new
executions. Only the three expected artwork modules differ; affected native paths
are freshly qualified. GitHub MCP finds no open PR at selection and recheck, so no
random application, merge, stale closure or rebase applies. Human screen-reader/
device acceptance remains deferred; native evidence makes no new UI conformance
claim. No release or new branch is created.

Private evidence stays in `.tmp/webp-encoder-boundary-2026-10-25/`: source/binary
identity, rejected drift evidence, corrected traces, native enum/token allocation,
gate logs, per-profile measurements and retirement checks. Vendor sources,
debugger programs and binaries stay outside Git. The
[standards reference](../.agents/skills/harmoniarr-web-standards/references/webp-encoder-boundary.md)
records the method and its limits.

## Recommendation and next item

Keep source-backed shared growth accounting, early owned refusal, hard native
limits and success controls. The benefit is rejecting this known failing input
before expensive encoding; the cost is a smaller admitted envelope. One growth
unit plus slack is not a bound on all content-dependent token pages, and arithmetic
admission still does not promise processing success.

Next: **evaluate a supported low-memory WebP encoding strategy against this fixed
candidate**, including quality, output bytes and runtime tradeoffs. The pinned
encoder's method 2 avoids this token-buffer path; compare effort 2 at quality 90
as a controlled alternative before changing production effort 4. Explicit
low-memory wrapper support is another capability decision. Do not keep
searching fixture dimensions or raising DATA to manufacture an accepted boundary.
