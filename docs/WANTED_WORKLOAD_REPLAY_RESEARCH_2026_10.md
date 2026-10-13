# Wanted workload replay official research, October 2026

Consulted October 13, 2026. URLs were discovered through MCP web search, opened
through the MCP service, and versioned PostgreSQL/W3C links followed from official
navigation. GitHub MCP repository search and metadata supplied the PR collection
URL. Consultation dates are distinct from publication dates.

| Source and status | Applied practice | Benefit | Cost or limit |
| --- | --- | --- | --- |
| [W3C High Resolution Time, September 1, 2026 Working Draft](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/) | Monotonic duration within one timing context; distinguish measurement from calendar time. | Clock changes do not distort elapsed work. | Draft, not a W3C Recommendation; it does not prescribe this Node benchmark or a performance target. |
| [Node 24 performance APIs](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html), runtime documentation | Use `performance.now()` for the awaited measurement window. | Same runtime timing family as existing service samples. | Host is Node 24.18.1; the opened documentation is 24.21.0. No runtime upgrade or new version-specific API is adopted. |
| [Node 24 globals](https://nodejs.org/download/release/v24.0.2/docs/api/globals.html), runtime documentation | Preserve an abort signal's original reason and use existing composed scenario signals. | Cancellation remains distinct from completed sample work. | The opened page is 24.0.2, not the host patch; native host evidence separately identifies TimeoutError. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Publish bounded approved failure class/code and project-relative source locations, excluding private payloads. | Useful failure evidence without dumping assertions or connection data. | Unknown codes remain unknown; optional logging cannot become a substitute for the original failure. |
| [node-postgres transactions](https://node-postgres.com/features/transactions), maintainer guidance | All transaction statements use one concrete client. | Matched sample rollback and private comparisons retain their owner. | Serial client work is required; increasing concurrency is not justified. |
| [PostgreSQL 18 application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) and [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), database documentation | Fresh authoritative reads under cooperating locks before skipping publication work. | Identifies the proof required for a later Wanted/link no-change path. | Row locks do not protect absent rows or host bytes; advisory protection requires participating writers. No production guard removal follows from a faster sample. |

The project choices below are inferences from these sources and the actual code,
not requirements imposed by W3C or OWASP.

## Alternatives and final stack

1. Keep the existing full matrix as an explicit milestone. Pros: all reviewed
   dimensions; cons: setup/media cost and long turnaround for a small diagnosis.
2. Add explicit reviewed selection with recorded scope. Pros: focused native
   feedback with unchanged private comparisons; cons: less coverage, which must
   remain visible. Recommend alongside the unchanged full default.
3. Reuse safe failure formatting and retain partial artifacts. Pros: source
   diagnosis without private payloads; cons: intentionally unknown messages/codes
   and no automatic root-cause determination. Recommend.
4. Retry, enlarge pools/deadlines or remove publication checks. Pros: potentially
   fewer observed failures/less work; cons: changes the contract and can conceal
   correctness defects. Do not adopt from this evidence.

Final stack: verified prerequisites -> explicit dimensions -> original guarded
benchmark and cleanup -> safe partial/failure artifact -> focused tests and
appropriate stable gate. Browser accessibility checks do not apply to this CLI;
no WCAG or whole-system security certification is claimed. See the separate
[design](WANTED_WORKLOAD_REPLAY_DESIGN.md) and
[outcome](WANTED_WORKLOAD_REPLAY_OUTCOME.md).
