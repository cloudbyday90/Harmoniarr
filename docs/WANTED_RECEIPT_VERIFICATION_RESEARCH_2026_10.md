# Wanted receipt verification: official practice review

Consulted October 12, 2026 through MCP search and primary-page navigation. Links
were discovered/opened, rather than inferred from product names. Scope is server
diagnostics and current private-file verification; no rendered UI changes.

## Applicable practices

| Primary source / status | Applicable practice | Implementation and proof |
| --- | --- | --- |
| [Node 24.21 performance APIs](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html), runtime documentation | `performance.now()` uses process-relative milliseconds; avoid retaining global performance entries for per-operation measurements | A private observer records elapsed phases without global marks; disabled/failed/backward-clock controls |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Monotonic durations avoid wall-clock adjustments; time origins and privacy limits matter | Use Node's runtime clock for server durations; omit absolute timestamps and public timing exposure. This is an application inference, not browser conformance or a final W3C Recommendation |
| [Node 24.21 Crypto](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html), runtime documentation | A streamed hash consumes successive buffers | Count each successfully hashed chunk, not declared receipt size. Actual-file controls prove exact totals and unchanged SHA-256 evidence |
| [Node 24.20 filesystem APIs](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html), runtime documentation | Separate accessibility checks introduce races before later filesystem operations | Preserve current realpath/private-root and before/after file checks, actual hashes and fresh guarded rereads. This does not eliminate every external filesystem race |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive data, encode structured output, and test logging failure without disrupting the application | Fixed names/counts, opaque diagnostic UUID, no paths/hashes/domain IDs/raw errors. Throwing/rejecting sinks and Error/null rollback controls; required audit remains transactional |
| [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/), cardinality-limits section Stable; document Mixed | Bound distinct metric attribute combinations and handle overflow deliberately | Apply the principle through fixed dimensions and saturating diagnostic counts. No OTel dependency/exporter is introduced; this is not an OTel-compliant SDK |

The consulted Node documentation versions are newer than the local Node 24.18.1
runtime. The used APIs predate that runtime; this change performs no runtime upgrade.
W3C draft status and OTel section-specific status are recorded explicitly. WCAG,
WHATWG controls and IETF mutation semantics remain relevant to future UI/HTTP work,
but adding an unrelated checklist would not validate this server-only change.

## Recommendations and tradeoffs

| Option | Benefits | Costs / risk | Recommendation |
| --- | --- | --- | --- |
| Fixed opt-in operation summaries | Counts actual work with small bounded per-operation state; supports failure diagnosis | Enabled clocks/callbacks/output add overhead; log retention remains operational responsibility | Implement now |
| Full per-file tracing or provider metadata | More attribution | Sensitive paths/owners and cardinality growth | Exclude from these diagnostics |
| Hash reuse across write/event gates | Less I/O | Could accept bytes replaced after an earlier observation | Reject |
| Bounded grouped/per-read verification | Could reduce lookup or scheduling overhead | Needs representative measurements, owning-client serialization and drain/refusal proof | Measure separately before implementing |
| Additional exporter or benchmark threshold in CI | Central aggregation or automated timing decisions | New dependency/resource ownership; noisy local timing is not a portable limit | Defer |

Final stack: existing guarded PostgreSQL transaction and current scope → modular
fresh receipt verifier → actual-byte counters and monotonic overlapping phases →
one optional private summary → explicit measurement decision. Preserve secure
current-state checks at every existing guard. The [design](WANTED_RECEIPT_VERIFICATION_DESIGN.md)
and [outcome](WANTED_RECEIPT_VERIFICATION_OUTCOME.md) separate architecture from
measured results and limits.
