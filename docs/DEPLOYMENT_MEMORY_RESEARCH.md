# Deployment memory research and recommendations

Consulted October 22, 2026 through Search Service MCP discovery and official page
reads. The qualification profile and workload sizes are engineering choices.

| Primary source | Applied practice |
| --- | --- |
| [Linux cgroup v2, version 7.0](https://docs.kernel.org/7.0/admin-guide/cgroup-v2.html) | Current and lifetime peak include descendants; memory categories overlap. Read existing controls without resetting peaks or requesting delegation. Keep sampled phase peaks distinct from lifetime peaks. |
| [Linux cgroup v1 memory controller](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html) | Usage is approximate; total counters include descendants; failcnt records limit hits. Retain the version/category names and do not invent a v2 OOM-event count. This Docker host uses v1. |
| [Node 24.22.1 process memory](https://r2.nodejs.org/docs/latest-v24.x/api/process.html) | RSS covers the Node process; ArrayBuffers are included in external memory. Neither is whole-container usage. Keep counters separate and sampling bounded. |
| [PostgreSQL 18 resource consumption](https://www.postgresql.org/docs/18/runtime-config-resource.html) | Shared buffers coexist with OS cache; work memory applies per operation and concurrent sessions can multiply it. Record actual settings and concurrent SQL ownership; do not apply the dedicated-database percentage to this shared app container. |
| [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints) | Hard memory and combined memory/swap are distinct. Qualify an explicit limit with equal memory-plus-swap to exclude additional swap. A host/free report does not establish container headroom. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/) | Memory, input size, time and concurrency need separate controls. Keep existing deadlines/admission limits while measuring their shared deployment cost. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/) | W3C Statement, May 15, 2025. Apply data minimization to numeric qualification output; no credentials, raw provider metadata or host paths. This application is an engineering inference, not standards certification. |

## Options

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Node RSS alone | Cheap; useful process signal | Omits PostgreSQL, children and charged cache; may retain allocations after work | Keep as a secondary observation |
| Container accounting plus controlled concurrent work | Includes the shared deployment and actual native/database owners; reproducible offline | Synthetic workloads and startup/fixture costs limit extrapolation | Implement this explicit lane |
| Live production stress | Exercises real catalogue and providers | Alters user work/data and makes causal comparison unreliable | Do not use for this qualification |
| Sum every process RSS | Easy to collect | Shared pages can be counted repeatedly | Reject as a container total |
| Available-memory-driven auto-tuning | Reacts to a momentary snapshot | Does not reserve future capacity and can race other allocators | Defer; retain explicit ownership |
| New metrics service or privileged cgroups | Could provide broader telemetry/isolation | Adds deployment/privilege outside the requested scope | Keep this work inside existing topology |

Chosen stack: finite container controls → existing embedded PostgreSQL and real
app composition → observed concurrent SQL/provider/native/publication work →
separate kernel/process/logical counters → acknowledged drainage → bounded numeric
evidence → workload-specific headroom assessment. Retain existing defaults until
broader measurements justify an operator-facing sizing policy.
