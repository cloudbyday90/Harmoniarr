# Artwork corpus research and recommendation

Researched October 22, 2026 using Search Service MCP search and official page reads.
URLs below were returned by those services or official navigation. Document status
and version labels were checked independently of their search-result dates.

## Applicable official sources

| Source | Verified practice | Application |
| --- | --- | --- |
| [W3C PNG Third Edition](https://www.w3.org/TR/png-3/) | Recommendation dated June 24, 2025. Defines 16-bit sample byte order, color/alpha types, chunk CRCs and sample-depth rescaling. | Generate actual valid 16-bit fixtures, verify native depth and distinguish eight-bit display projection from original sample precision. This is selected PNG behavior, not full PNG/APNG conformance certification. |
| [Sharp metadata](https://sharp.pixelplumbing.com/api-input/) | Header metadata exposes channels, native depth and PNG bits per sample without decoding compressed pixels. | Assert actual input metadata and require pre-rewrite refusal for the large 16-bit case. |
| [Sharp output](https://sharp.pixelplumbing.com/api-output/) | PNG output defaults to eight bits; explicit rgb16 conversion is needed for 16-bit output. EXIF writing is supported for fixture construction. | Compare accepted PNGs at the current canonical eight-bit projection; verify real synthetic EXIF before its removal. Preserve the current product policy. |
| [Node 24.22.1 process API](https://r2.nodejs.org/docs/latest-v24.x/api/process.html) | Available-memory and constrained-memory queries are stable; an unknown/absent constraint returns zero from constrainedMemory. | These observations do not reserve memory. Treat unknown constraints explicitly in any future aggregate policy. |
| [Linux cgroup v2, 7.0 documentation](https://docs.kernel.org/7.0/admin-guide/cgroup-v2.html) | Memory limits, current usage, pressure/events and group accounting have different meanings; limits can be overcommitted. | Keep actual kernel profile/OOM evidence separate from per-child DATA and sampled RSS. Do not infer aggregate safety by adding measurements. The local host exposes v1, which the fixture also verifies. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/) | Processing, memory, concurrency and input-size controls address distinct resource costs. | Retain byte/pixel/admission/deadline/kernel controls together; do not replace them with a single free-memory threshold. |

## Findings and pros versus cons

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Fixed diverse synthetic corpus | Reproducible, private, validates bit depth and real pixels | Does not represent all image algorithms/profiles or malicious complexity | Add an explicit seven-case native lane |
| Put large corpus cases in every fast run | Broad automatic repetition | Slower feedback, resource contention, duplicated native work | Keep expensive qualification explicit |
| Lower child memory cap from moderate-image peaks | Smaller nominal allocation allowance | Discards prior maximum-JPEG evidence; samples are not bounds | Retain the qualified 1 GiB DATA cap |
| Global sampled free-memory threshold | Easy to query and observe | Race-prone; no reservation, fragmented/other-process use and unknown constraints | Useful supporting signal, insufficient admission authority |
| Staged metadata plus aggregate reservation in the app | Can coordinate predicted native work while preserving current deployment | Requires protocol, cancellation, retirement and retained-buffer accounting | Recommended next implementation after an owned lifecycle design |
| Separate decoder deployment | Independent cgroup/capability policy possible | Additional service ownership, outside operator scope | Do not introduce |

## Final recommendation stack

Retain bounded intake and the current shared admission → per-child verified DATA
limits → sample-depth metadata admission → bounded native rewrite/deadline → exact
result and successful close → parent publication. Add the native corpus as the
explicit evidence layer, alongside existing maximum-byte/pixel and allocation
controls. Preserve fixed private failures and metadata minimization.

For aggregate work, prefer staged reservations inside the existing app. Record
parent buffers and child baseline before accepting extra decoded-work weight;
retain reservations through actual retirement. The proposed reservation amounts
need workload/lifecycle evidence rather than a multiplier fitted to these samples.
This is an engineering inference from the sources and measurements, not a W3C,
OWASP or kernel guarantee of production-wide memory safety.
