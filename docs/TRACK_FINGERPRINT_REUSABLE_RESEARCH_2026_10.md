# Reusable fingerprint reads: official October 2026 review

Consulted October 13, 2026 through MCP search and primary-page navigation.
Separate [design](TRACK_FINGERPRINT_REUSABLE_DESIGN.md) and
[outcome](TRACK_FINGERPRINT_REUSABLE_OUTCOME.md) documents own implementation and
measured proof.

| Primary source / status | Applicable contract | Project decision and proof |
| --- | --- | --- |
| [Node 24.20 FileHandle APIs](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html), vendor runtime documentation | Positional reads fill the supplied buffer and return actual bytes; explicit close waits for pending handle operations | Sequential awaited reads into one bounded buffer; hash only returned bytes; handle short reads/early EOF; await close and preserve primary Error/null |
| [Node 24.21 Crypto](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html), vendor runtime documentation | SHA-256 accepts Buffer views through successive updates and final digest | Hash the filled subarray synchronously before reusing it. Compare actual evidence privately against stream results and poisoned-tail/short-read controls |
| [Node 24.20 process memory](https://nodejs.org/download/release/v24.20.0/docs/api/process.html), vendor runtime documentation | RSS/heap/external/ArrayBuffers represent different memory observations; ArrayBuffers are included in external and sampling can cost work | Record baseline/observed peak/delta separately in isolated processes. Do not add overlapping fields or treat sampled peaks as strict maxima |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Monotonic duration measurement differs from wall time; timing precision has privacy implications | Use Node process-relative durations in private measurement records; this is an application inference, not browser conformance or a final W3C Recommendation |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive data and preserve application operation through logging failure | Fixed method/buffer/count/memory fields; omit paths, hashes, IDs, SQL/provider data and child stderr. Optional byte telemetry cannot replace evidence or original failure |

Local Node 24.18.1 supports the used stable APIs. New experimental iterator APIs
in newer documentation remain outside the change. File/path/descriptor checks
improve binding within the existing application contract; they do not imply
kernel-atomic directory confinement against hostile external rename races.
No runtime/dependency/schema/UI/HTTP change follows from this experiment.

## Recommendations and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Reusable read-only handle / 256 KiB | Lower observed allocation peaks and large-file median; descriptor/path identity binding | More explicit read/EOF/stat/close logic; concurrency/platform scaling unmeasured | Adopt with focused/native proof |
| Reusable / 64 KiB | Low configured buffer and observed memory | More read/iteration steps | Keep internal option |
| Reusable / 1 MiB | Lowest local large-file median | Larger per-call allocation and sampled peaks | Keep internal option |
| Stream / 64 KiB | Existing comparator and owned stream close | Repeated buffer allocation | Preserve internal baseline |
| Whole-file memory or historical hash reuse | Simple invocation or less I/O | File-sized allocation or stale availability authority | Reject |

Recommended stack: owning guard → current private-root/path evidence → descriptor
binding → bounded sequential reusable SHA-256 read → descriptor recheck/close →
pathname/root recheck → unchanged receipt/publication rules. Adopt based on actual
identity, byte, memory and ownership proof, not elapsed time alone. WCAG/WHATWG/
IETF UI/HTTP practices remain relevant when those flows change; they do not add
evidence to this server-only read implementation.
