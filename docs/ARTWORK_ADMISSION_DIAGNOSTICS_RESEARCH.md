# Artwork admission diagnostics research

Reviewed October 25, 2026 using MCP search and primary-source retrieval. See
[design](ARTWORK_ADMISSION_DIAGNOSTICS_DESIGN.md) and
[outcome](ARTWORK_ADMISSION_DIAGNOSTICS_OUTCOME.md).

| Official source | Application |
| --- | --- |
| [OWASP API property authorization](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/) | Retain administrator authorization; explicitly project only needed response fields, including in exports, instead of serializing internal objects. |
| [Node process memory](https://nodejs.org/api/process.html) | Distinguish process RSS, V8 heap, external memory and ArrayBuffers. ArrayBuffers are included in external; process memory is not the application's child/PostgreSQL/container total. Reuse the monitor's cached sample rather than adding page-walking reads to each refresh. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Loading/completion feedback should be programmatically exposed without moving focus. Do not turn an entire changing metric panel into a live announcement. |
| [W3C keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Preserve the refresh control's focus during a request with aria-disabled and an explicit activation guard; restore availability after completion without focusing another element. |

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Fixed projection of the actual built-in gate, cached process sample, existing diagnostic requests | Accurate ownership, bounded work and no extra collector | Snapshot meanings/times differ and must remain explicit. Recommended. |
| New service or independently reconstructed gate | Separate implementation | Can report the wrong owner and duplicates lifecycle. Reject. |
| Full queue objects or arbitrary error/history serialization | More detail | Unnecessary sensitive data/cardinality. Reject. |
| Automatic resource tuning from a sample | May increase throughput | Observed memory does not prove a native allocation bound. Reject. |

Recommended stack: actual gate ownership; fixed validated fields; administrator
read-only/no-store delivery and export allowlist; distinct logical/process labels
and timestamps; existing manual-refresh lifecycle with quiet status feedback;
focused lifecycle/HTTP/browser proof. This stack is a repository-specific inference
from the official guidance, not a new standards-mandated memory formula.
