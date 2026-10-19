# Reporter recommendations, October 2026

Consulted 2026-10-19 through MCP search/open and GitHub metadata. Source status
and installed-runtime observations are distinguished below.

| Source | Recommendation applied |
| --- | --- |
| [Node test reporter documentation](https://r2.nodejs.org/docs/latest-v24.x/api/test.html) | Official Node 24 guidance: custom reporters transform TestsStream events through the compose contract. Keep reporter/destination pairing and one owned custom consumer for related structured outputs. Current docs describe 24.22; local reproduction uses installed 24.18.1. |
| [Node stream documentation](https://r2.nodejs.org/docs/latest-v24.x/api/stream.html) | Official API guidance: pipeline/finished can retain listeners, and pipeline destroys streams on errors. Inspect actual ownership rather than removing listeners belonging to another component. Use async-generator control flow and real process/output close. |
| [Node event documentation](https://nodejs.org/download/release/v24.16.0/docs/api/events.html) | Official guidance: trace warnings and inspect their emitter/event/count. The default threshold is a diagnostic; changing it does not fix ownership. No blanket listener removal or warning suppression. |
| [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Informative security guidance: retain bounded approved diagnostics without credentials or raw private test/error content. Preserve existing early-failure formatter and private case hashing. |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/) | September 1 Working Draft. Monotonic elapsed measurements inform descriptive local timings; browser timing guidance does not certify this Node reporter or imply a CI speedup. No new timing system is needed. |

## Alternatives and final recommendation

| Option | Pros | Cons |
| --- | --- | --- |
| Raise listener limits or hide warnings | Small immediate configuration change | Conceals the observed fan-out and unrelated future warnings; rejected |
| Delete Node's listeners after setup | Could reduce the count | Violates ownership and risks lost completion/error propagation; rejected |
| Replace the CLI with a custom test coordinator | Complete control of fan-out | Broad new scheduling/output lifecycle and compatibility burden; unnecessary |
| Combine owned structured reporting, retain spec | One custom source consumer; existing formats and serial runner remain | Structured outputs share one failure/backpressure boundary, which needs adverse tests |
| Upgrade Node solely to remove this warning | Could change upstream behavior | Does not establish a fixed version or preserve the current baseline; defer |

Recommend the existing modular Node 24 ESM platform and native serial test CLI,
with spec plus a shared structured reporter only for cohort-enabled files.
Keep strict complete evidence, bounded diagnostics, existing limits and current
PostgreSQL ownership. Qualify development-tool versions separately in the
[PR 45 outcome](OPEN_PR_45_LOCAL_EVALUATION_OUTCOME.md). The
[design](TEST_REPORTER_OWNERSHIP_DESIGN.md) and
[outcome](TEST_REPORTER_OWNERSHIP_OUTCOME.md) record actual evidence and limits.

## Next runtime recommendation

The host is Node 24.18.1 while Dockerfile defaults to 24.21.0-alpine. The official
[24.22.0 release](https://nodejs.org/uk/blog/release/v24.22.0) is dated October 14.
The Node project's [October security announcement](https://github.com/nodejs/nodejs.org/blob/main/apps/site/pages/en/blog/vulnerability/october-2026-security-releases.md)
announces a Node 24 security release on or shortly after October 21, with the
highest issue rated high. As of this October 19 consultation, that release is
future work: do not invent its version, advisory details or mitigation status.

Next qualify one maintained Node 24 baseline across host, CI and Docker with the
reporter, native TLS and built-browser contracts. Recheck the announcement before
selecting the final image/version. A common baseline reduces version drift but
needs real Linux/container qualification; changing the reporter alone does not
qualify another Node version. Keep that upgrade separate from this commit.
