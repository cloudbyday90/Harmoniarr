# Aggregate memory research and recommendation

Researched October 22, 2026 through Search Service MCP discovery and official page
reads. Version/status labels below were verified. Design constants and scheduling
choices are engineering inferences, not values prescribed by a standards body.

| Official source | Relevant contract/practice | Applied decision |
| --- | --- | --- |
| [Node 24.22.1 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html) | Parent stdin is writable, stdout readable; close follows process completion and closed stdio, while exit alone does not establish stream retirement. | Reuse the existing streams for binary input/metadata/grant and retain ownership through close. Do not use extra descriptor-file assumptions or shell composition. |
| [Sharp metadata](https://sharp.pixelplumbing.com/api-input/) | Native header metadata exposes size, channels and depth without decoding compressed pixel data; rotation affects the intended output dimensions. | Validate oriented dimensions/depth before grant, then reuse the original worker's inspection for rewriting. Do not move untrusted native parsing into the parent. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/) | Input size, processing time, memory and concurrent operations require distinct controls. | Add aggregate logical reservations while keeping queued-byte limits, native/data/output limits and deadlines. |
| [Linux cgroup v2, 7.0 documentation](https://docs.kernel.org/7.0/admin-guide/cgroup-v2.html) | Memory current/peak, high/max limits and OOM behavior describe different resource/accounting mechanisms. | Report real kernel evidence separately from application reservation counters; do not label a logical allowance an RSS ceiling or cgroup reservation. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/) | Statement dated May 15, 2025; data minimization limits unnecessary exposure. | Engineering inference: grant only a fixed numeric/enum projection, keep source metadata/publication authority in the parent and avoid raw diagnostic disclosure. This is not W3C security certification. |
| [W3C PNG Third Edition](https://www.w3.org/TR/png-3/) | Recommendation dated June 24, 2025; image sample depth affects pixel representation. | Continue native 8/16-bit qualification and conservative depth accounting; compressed bytes alone do not predict decoded work. No broad PNG/APNG conformance claim is made. |

## Alternatives, pros and cons

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Active-count limit alone | Simple and already shared by artwork owners | Equates thumbnails and expensive decoded images | Retain as one bound, add active weight |
| Baseline reservation followed by a blocking increase | May admit inspection work cheaply | Two baseline holders can deadlock while requesting increases; needs additional victim/admission policy | Reject for this change |
| Conservative initial allowance followed only by reductions | No increase deadlock; same FIFO/cancellation owner; metadata can recover capacity | Conservative preflight can serialize or refuse work that would eventually fit | Implement |
| One permanently worst-case allowance per job | Simple and bounded accounting | Prevents metadata from recovering useful capacity | Use only until metadata is validated |
| Sample available memory before each job | Low-cost supporting observation | Another allocator can consume it afterward; no durable ownership | Do not use as reservation authority |
| Separate worker service/cgroup delegation | Additional isolation may be possible | New service/privilege outside the operator's requested scope | Do not introduce |

## Chosen recommendation stack

One existing FIFO owns count, waiting bytes and active reservation weight. Reserve
before intake → existing minimal child/DATA limit → bounded native metadata →
validated monotonic reduction → exact parent grant/EOF → bounded native work and
result → successful close → parent publication → release the remaining weight.

The default active budget is 2 GiB, with explicit conservative input/output/runtime
allowances documented in the [design](ARTWORK_AGGREGATE_DESIGN.md). The maximum
JPEG measurements from prior rounds justify retaining the 1 GiB child DATA cap;
moderate corpus peaks do not justify reducing it. Logical reservation totals are
testable invariants but remain a model of job-owned memory, not an OS allocation
or an assurance that native code reports truthful metadata after compromise.

Keep fixed owned resource failures through fetch batches. Validate original task
lifetime, cancellation/timeout, protocol refusal and publication separately from
kernel OOM behavior. Next, measure this policy alongside real parent/provider/
database memory ownership and derive deployment/operator sizing without adding
a second app or using a free-memory snapshot as a substitute for reservations.
