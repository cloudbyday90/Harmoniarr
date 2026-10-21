# Manual session signals: research and recommendations

Consulted October 21, 2026. Primary URLs were discovered with MCP search or
official navigation and opened with the MCP web service. Saved URLs alone were
not treated as current verification.

## Applicable practices

| Authority and source status | Relevant practice | Project decision |
| --- | --- | --- |
| [Node 24 process](https://nodejs.org/docs/latest-v24.x/api/process.html), vendor API documentation | Signal listeners change default termination; Windows signal emulation is not POSIX handler delivery. | Execute native Linux signals against a spawned child after listener readiness. Do not label controlled EventEmitter events as native proof. |
| [Node child process](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), vendor API documentation | A signal request is not process termination; close includes stdio completion. | Await owned child close and retain failure after cleanup. |
| [Docker kill](https://docs.docker.com/reference/cli/docker/container/kill/), vendor CLI documentation | Custom signals target the main process; shell entrypoints affect forwarding. | Run Node directly without a shell. This lane signals a child inside Linux rather than asserting container PID 1 forwarding. |
| [Docker run](https://docs.docker.com/reference/cli/docker/container/run), vendor CLI documentation | Runtime supports independent network, user, mount and resource constraints. | Inspect effective isolation, full ID and actual exit before exact removal. |
| [OWASP Docker guidance](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html), informative security guidance | Avoid the daemon socket; use least privilege, read-only filesystems and resource limits. | No socket/network/ports, five read-only files, non-root, dropped capabilities and bounded resources. |
| [WAI user evaluation](https://www.w3.org/WAI/test-evaluate/involving-users/), informative guidance | Combine standards evaluation with real user experience and qualify conclusions. | Keep screen-reader/device checks deferred; successful signal tests cannot stand in for manual acceptance. |
| [WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/), W3C Group Note, July 23, 2026 | Scope, sample and report evaluation evidence; this adds no WCAG criteria. | Record specific tested boundaries and unperformed checks separately. |

The rolling process page displayed 24.22.1; installed/runtime versions are checked
independently. The first child-process open was unavailable; official navigation
and the successful follow-up lookup are recorded in private research evidence.
No dependency upgrade follows merely from a documentation header.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Emit signal events in fast tests | Cheap, deterministic admission/cleanup assertions | Does not execute OS delivery | Keep existing controls, with limited claims |
| Terminate a Windows child | Exercises actual Windows process close | Forceful emulation cannot qualify POSIX listeners | Do not use as Linux signal evidence |
| Isolated Linux input/runner lane | Actual signals and pipe close; small deterministic scope; no privileged socket | Controlled session does not prove full database shutdown under a signal | Implement this round |
| Full Linux application/Docker orchestration | Broader end-to-end signal coverage | Requires separate database/network orchestration and more expensive ownership proof | Defer until operational need warrants this larger lane |

## Recommendation stack

1. Small ESM CLI runner plus the existing AbortSignal/input and session owners.
2. Fast controlled tests for admission and failure identity.
3. Explicit pinned Linux signal lane with inspected least-privilege isolation.
4. Existing native HTTP/PostgreSQL/browser lane for real session consumers.
5. Actual operator/device acceptance using the prepared manual procedure.

Extend the existing project standards/testing skills instead of creating another
overlapping skill. Put signal-specific evidence rules in a conditional reference
so ordinary UI work does not inherit infrastructure procedures.
