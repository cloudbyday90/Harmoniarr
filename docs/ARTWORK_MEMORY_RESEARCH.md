# Artwork memory research and recommendation

Researched October 22, 2026 through Search Service MCP search, official navigation
and page reads. Version labels and document status below were checked; links were
discovered through those services. These recommendations apply to decoder memory
inside the existing application, following the operator's scope correction.

## Primary sources and applicable practices

| Source | Verified guidance | Application decision |
| --- | --- | --- |
| [Linux man-pages: getrlimit/prlimit](https://man7.org/linux/man-pages/man2/prlimit.2.html) | DATA limits affect data/heap allocations and relevant mmap calls since Linux 4.7; soft limits are enforced and unprivileged hard-limit increases are restricted. | Lower both DATA limits before Node exec, verify the effective limits, and test allocation refusal. Do not describe DATA as RSS. |
| [util-linux prlimit manual](https://man7.org/linux/man-pages/man1/prlimit.1.html) | A command can be launched with explicit soft:hard limits. | Absolute executable, fixed numeric arguments and no shell. Missing limiter refuses work. |
| [Node 24 CLI](https://r2.nodejs.org/docs/latest-v24.x/api/cli.html) | Node 24.22.1 documents JIT-less execution as experimental, with possible severe performance cost; old-space sizing limits V8 old space. | Child-only JIT-less/128 MiB old-space settings, actual output/deadline qualification and upgrade requalification. Heap limits alone are insufficient. |
| [V8 JIT-less explanation](https://v8.dev/blog/jitless) | Interpreter execution avoids runtime executable-memory allocation; performance effects depend on workload. Published March 2019, not a new October 2026 guarantee. | Measure this pinned child/runtime rather than assume general application speed or memory savings. |
| [Alpine v3.23 x86_64 package](https://pkgs.alpinelinux.org/package/v3.23/main/x86_64/util-linux-misc) | Maintained util-linux-misc 2.41.6-r1 provides prlimit; built September 5, 2026. | Install the package and inventory its exact additions. Local native qualification is amd64; arm64 behavior needs its own evidence. |
| [Sharp security](https://sharp.pixelplumbing.com/security/) | Recommends current dependencies and OS/container controls for untrusted images. Current linked Sharp release is 0.35.5. | Retain byte/pixel limits, process retirement and deployment controls; DATA adds a narrower allocation guard. It does not replace a complete sandbox. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/) | Bound processing, memory, input sizes and concurrent resource use. | Preserve shared admission/deadlines and add independently verified child allocation limits. No single knob covers the whole request. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/) | W3C Statement, May 15, 2025; advocates minimizing data exposure. | Engineering inference: child-only bytes/policy and fixed diagnostics reduce incidental exposure. W3C does not prescribe a decoder memory ceiling; this is not W3C security/accessibility certification. |

## Measurements used to choose the policy

The pinned Linux amd64 Node 24.22.1/Sharp 0.35.5/libvips 8.18.7 image was tested
with a minimal child environment. With Sharp loaded, default Node reported roughly
593,000 KiB DATA against about 74,000 KiB RSS. A 128 MiB old-space flag alone did
not remove that reservation. JIT-less plus that heap flag reported roughly
68,744 KiB DATA and 69,216 KiB RSS in one startup sample. These observations explain
the launch choice; they are not throughput benchmarks, steady-state memory savings
or worst-case image bounds.

An initial **768 MiB DATA** candidate failed the real 8192-square JPEG rewrite.
A diagnostic using the actual native pipeline reported `VipsJpeg: Insufficient
memory (case 4)`. At **1 GiB DATA**, the same input retained its expected output;
one diagnostic child reported a kernel maximum RSS of 868,256 KiB. Preserve that
failed candidate separately; do not raise deadlines or suppress the max-image case
to make the lower ceiling appear compatible.

Concurrent maximum-pixel experiments produced opaque native rewrite failures in
both one- and two-CPU profiles, alongside successful separate runs. Elapsed times
do not identify the cause of those historical failures. They are retained as
load-sensitive stress evidence. The final correctness lane qualifies two concurrent
maximum-byte inputs; the separate single maximum-pixel case remains required.
This is a narrower declared scope, not a repaired maximum-pixel pair or a speedup.
Production deadlines and concurrency are unchanged. Executed final counts,
memory samples and immutable-image checks belong in the
[outcome](ARTWORK_MEMORY_OUTCOME.md).

## Alternatives and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Heap/cache/thread knobs alone | Cheap, already available | Exclude significant external/native allocations | Retain as supporting controls |
| Estimated decoded-image admission | Refuses predictable expensive combinations before rewrite | Conservative; native allocation patterns vary | Add before rewrite |
| Per-child Linux DATA soft/hard limit | Kernel allocation refusal, no daemon or new service, applies before exec | Not RSS/cgroup isolation; runtime reservations and allocator behavior matter | Add and verify on supported Linux |
| Address-space limit | Broad virtual-address coverage | V8/native reservation requirements complicate a useful ceiling | Do not adopt without separate qualification |
| Separate decoder container/service | Independent cgroup and OS capabilities possible | Additional deployment/service ownership; rejected by operator | Out of scope |
| Privileged in-app cgroup delegation | Could separate child accounting within a deployment | Requires authority/delegation absent from current container | Do not grant privilege for this change |

## Final recommendation stack

Use the existing shared admission → bounded original bytes → minimal disposable
child with pre-exec DATA/core limits and child-only JIT-less execution → metadata
memory admission → native policy/deadlines → bounded result and actual successful
close → parent-owned publication. Temporary resource/native rewrite failures must
propagate without provider-absence backoff.

This adds bounded allocation behavior while keeping the single deployed app. It
trades some maximum-format combinations and child JS optimization for a useful
kernel guard. Keep overall container sizing explicit: accepted allocations across
two children, the server and embedded PostgreSQL can still compete for memory.
Next, qualify diverse high-entropy/sample-depth inputs and measure aggregate
admission needs inside this application before changing concurrency or pooling.
