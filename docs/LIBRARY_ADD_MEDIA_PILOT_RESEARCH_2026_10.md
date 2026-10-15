# Canonical media pilot official research

Consulted 2026-10-15 through GitHub MCP repository metadata and search-service
MCP discovery/opening. Links below were returned by those services. This is an
implementation decision based on applicable sources, not a conformance audit.

## Applicable practices

| Primary source and status | Application here | Evidence owner |
| --- | --- | --- |
| [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/), current vendor guidance | Explicit read-only media bind; account for daemon-host paths and recursive submount behavior | Existing owned transport verifies the exact nonrecursive mount; scoped adapter uses the actual child root |
| [Engine API 1.56](https://docs.docker.com/reference/api/engine/version/v1.56/), vendor API reference | Keep reviewed API/version and current ownership checks; reads do not authorize arbitrary lifecycle actions | Existing local reader and shared CLI/API validator; pilot reuses them |
| [Protect the Docker daemon socket](https://docs.docker.com/engine/security/protect-access/), vendor security guidance | Treat daemon control as privileged access, even when this reader only issues GETs | Trusted host-side fixture; media containers receive no daemon socket |
| [Node test runner 24.8](https://r2.nodejs.org/dist/v24.8.0/docs/api/test.html), versioned runtime documentation | Name filtering does not filter files; asynchronous activity can outlive a reported test | Literal file selection and actual returned scenario/database/close completion |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), Working Draft dated 2026-09-01 | Use monotonic elapsed durations and separate them from wall-clock timestamps | `performance.now()` scenario/close windows and existing transport observer |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Exclude credentials/private payloads and isolate optional logging failure | Fixed aggregate record after close; throwing sink controls preserve original outcomes |

Observed host: Node 24.18.1 on Windows; Docker Linux Engine 29.8.2/API 1.56.
The versioned Node 24.8 reference predates this host and supports the stable
runner behavior used here; it is not a claim that 24.8 is the latest release.
W3C's timing draft remains work in progress. No browser interaction changed,
so this pilot adds no keyboard, assistive-technology or WCAG conformance claim.

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing per-command inspection | Simple fresh process/container boundary; existing comparator and local-tool support | Repeats container startup for every current inspection | Keep default during pilot |
| Scenario-owned API inspection | Reuses one verified media owner and bounded read connection while retaining all inspections; narrower measured adoption | More owner/reader lifetime state; local privileged daemon dependency; retains artifacts on uncertainty | Explicit opt-in for this canonical cohort |
| Switch all cohorts by default | Potential broader startup savings | Unmeasured callers, failure paths and platform interactions | Defer |
| Cache measured metadata or skip checks | Less work | Can miss changed bytes/current policy and bypass delivery verification | Reject |
| Move Engine exec/lifecycle to API too | May remove further CLI startup | New stream, cancellation and lifecycle authority contracts | Separate future design |

## Recommended stack

1. Existing guarded reusable workspace/database lifetime.
2. Narrow per-scenario ESM media adapter, with explicit `owned-api` selection.
3. Existing immutable media image, local Engine reader and verified CLI lifecycle.
4. Unchanged canonical application/worker/current-file assertions.
5. Focused reversed-order measurements, complete owning cohort and fast gate.
6. Existing practical standards/testing skills with a maintained evidence map.

These are project choices inferred from the sources and repository evidence.
Neither Docker nor W3C mandates this fixture architecture. Keep the comparison
scope explicit before deciding whether this cohort's default should change.
