# PostgreSQL runtime cleanup official research

Consulted 2026-10-15 using MCP search/opening and GitHub repository metadata.
Links below were discovered through those services. Host Node is 24.18.1,
npm 12.0.2, Testcontainers and its PostgreSQL module 12.1.0; Docker Engine is
29.8.2. No dependency upgrade is needed for this correction.

| Primary source and status | Relevant practice | Application |
| --- | --- | --- |
| [Testcontainers container lifecycle](https://node.testcontainers.org/features/containers/), current maintainer documentation | Specify a stop timeout when completion must be awaited; container and volume removal are configurable | Retain the existing bounded stop call; await its returned promise and propagate rejection in either schema mode |
| [Node 24 test runner](https://r2.nodejs.org/docs/latest-v24.x/api/test.html), vendor documentation, opened as 24.22.0 | Asynchronous activity can outlive a reported test; timeout alone is unreliable cancellation | Hold the actual stop promise, observe rejection immediately and drain registered native operations; use APIs supported by installed 24.18.1 |
| [ECMAScript 2026 statements](https://tc39.es/ecma262/2026/multipage/ecmascript-language-statements-and-declarations.html), versioned specification algorithms | Throw carries the expression value; an abrupt finally can replace prior completion | Keep explicit failure flags, preserve null and avoid a finally throw replacing the primary failure |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement dated 2025-05-15 | Minimize transferred personal data | Apply the principle to infrastructure evidence: record bounded outcomes without connection strings or raw database identity; this is a project application, not a fixture-specific W3C mandate |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude passwords and database connection strings; test error handling in logging | Keep existing bounded diagnostics and original failures; add no raw connection logging or success conversion |

The ECMAScript living document search identifies an October 2026 draft for the
next edition; the opened versioned 2026 algorithms above are used for the stable
throw/try semantics. The source does not prescribe this project's failure
precedence policy. W3C's Statement is distinct from a Recommendation, and this
infrastructure-only change makes no WCAG or browser-conformance claim.

## Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Correct the condition in the existing owner | Small, reviewable patch; preserves order, identity and deadlines; no new dependency | Previously green empty-schema teardown can now fail correctly | Implement |
| Extract another general cleanup abstraction | Could centralize repeated policy later | Additional indirection without a new owner; unnecessarily broad for this defect | Defer until a concrete shared need |
| Replace primary failures with AggregateError | Makes multiple errors visible | Changes Error/null identity and existing caller contracts | Reject for this slice |
| Retry stop or swallow rejection | Can appear to reduce failures | Hides uncertainty, changes bounded work and may report false success | Reject |
| Retain every app workspace after any database stop failure | Simple conservative rule | Conflates separate storage owners and discards valid quiescence evidence | Keep existing explicit guards |

Recommended stack: existing modular ESM runtime → one canonical cleanup promise
→ awaited template then bounded owned stop → explicit primary-failure precedence
→ independent workspace quiescence/identity guard → fast contract tests plus two
native ownership cases. This is our engineering recommendation derived from the
sources and local evidence, not a claim of standards certification.

See [design](POSTGRES_RUNTIME_CLEANUP_DESIGN.md) and
[outcome](POSTGRES_RUNTIME_CLEANUP_OUTCOME.md).
