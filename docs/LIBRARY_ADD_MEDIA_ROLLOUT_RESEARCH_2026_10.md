# Canonical media rollout official research

Consulted 2026-10-15 through MCP search/opening and GitHub repository metadata.
Versioned Node links were discovered in the official test page navigation, not
constructed from an assumed documentation layout. Host Node is 24.18.1; the
24.8 documentation predates it and describes the APIs used here. Docker Engine
is 29.8.2/API 1.56. This is selected guidance, not a standards certification.

| Primary source/status | Applicable practice | Project decision/evidence |
| --- | --- | --- |
| [Node test runner 24.8](https://r2.nodejs.org/dist/v24.8.0/docs/api/test.html), vendor documentation | Name filters do not narrow files; asynchronous work can outlive reporting | Literal cohort paths, no larger automatic matrix, actual cleanup completion |
| [Node module API 24.8](https://r2.nodejs.org/dist/v24.8.0/docs/api/module.html), vendor documentation; synchronous customization hooks are an evolving API | A fresh process can observe/refuse actual module resolution | Guard the media-only graph before application/database imports; keep hooks test-only |
| [Node child process 24.8](https://r2.nodejs.org/dist/v24.8.0/docs/api/child_process.html), vendor documentation | Direct executable/argument arrays avoid a shell; returned completion owns stdio close | Preserve existing execFile commands and bounded focused child probes |
| [Docker Engine API](https://docs.docker.com/reference/api/engine/), current vendor documentation | Client/server API compatibility is an explicit boundary | Keep reviewed local API 1.56 refusal; do not infer Ubuntu compatibility from a Windows sample |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), Working Draft dated 2026-09-01 | Monotonic durations measure elapsed work independently of clock adjustment | Compare recorded command/scenario windows separately; retain host-load qualification |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude secrets/private payloads and preserve behavior through optional logging failure | Keep fixed counters and private raw artifacts; no expanded diagnostic payload |

## Options and trade-offs

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Promote owned API globally now | Easier access to fewer container starts | Unproved CI/platform/version coverage; setup/load variation remains | Defer |
| Keep explicit pilot and separate media/policy modules | Preserves compatibility and security guards; media-only imports avoid SQL/application graph | Keeps two execution paths and adds two focused modules | Implement |
| Lazy-import the whole database fixture | Delays initial work | Still loads unrelated SQL at first media use and obscures ownership | Prefer direct dependency separation |
| Remove repeated inspections or increase test parallelism | May reduce observed wall time | Changes verification/resource work and invalidates the comparator | Reject for this slice |

Recommended stack: pure option policy, Node-only media tools, scoped owner adapter,
existing guarded reusable runtime, reviewed Engine reads plus CLI lifecycle,
unchanged canonical checks and explicit native/fast validation. This architecture
is a project inference from source and repository evidence; the standards do not
mandate these filenames. No browser behavior changes, so no new WCAG or
assistive-technology conformance is claimed.
