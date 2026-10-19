# Test reporter ownership outcome

Date: 2026-10-19. Implements the
[design](TEST_REPORTER_OWNERSHIP_DESIGN.md) using the
[official research and tradeoffs](TEST_REPORTER_OWNERSHIP_RESEARCH_2026_10.md).

## Finding and implementation

On installed Node 24.18.1, a two-test database-free fixture with spec plus two
custom reporters reproduced 11 end listeners on TestsStream. Trace-warnings
located pipeline/compose reporter fan-out. This establishes the configuration
trigger, not an accumulating application leak or a cause of earlier PostgreSQL
failures. The same fixture with spec plus one combined reporter has no warning.

The new integration-evidence-reporter.js consumes structured events once and
reuses early-failure-format.js. The new postgres-cohort-accumulator.js contains
the existing bounded phase/count/digest logic; both combined and standalone
cohort reporters use it. A failed/closed accumulator cannot later finish.
postgres-file-process.js selects the combined reporter only when cohort evidence
is requested. Native spec remains independent on stdout; structured records use
stderr. Direct spec plus early-failure commands retain their current shape.

Early failures remain observable before a later held case finishes. Final cohort
output requires actual source exhaustion; a summary alone cannot publish it.
Source Error/null propagates unchanged, accumulator refusal prevents final output and
consumer return finalizes the source. Serial admission, strict zero-skip evidence,
process/output close, cancellation and output backpressure retain their existing
owners. No listener removal, threshold change, warning filter or private Node
runtime hook is added. The implementation remains modular ESM.

## Final validation

Frozen code/configuration: 3,042 files, source SHA-256
f9147a59e4c6327ec405fe21848bb01921af1d430287f268d9ce3430e05e1ea6.
PR 45's exact package pair is included. Native/browser source and built assets
are compared before/after their respective collections; final staged bytes are
checked against the tested code manifest.

| Evidence | Result |
| --- | --- |
| Focused reporter/process/coordinator/cohort tests | 79 pass; no failures, skips or cancellations |
| Native passing/skipped/failing reporter controls | Exact standalone counts/digest/phases; skipped evidence still rejected; held failure emits early and exits 1 naturally |
| Ordinary emitter warning control | Default maximum remains 10; an intentional 11-listener EventEmitter warning still reaches native spec |
| Final validate:fast | 10,526 pass: server 5,463, client 4,384, scripts 679; lint/policy checks and client/server builds pass; 116.8 seconds |
| Selected real PostgreSQL | 11 pass: HTTP/session/default-CSRF 4, TLS identity 5, driver contracts 2; strict cumulative records and no listener warning |
| Selected built-app Chromium | 3 pass: default-CSRF settings submission, lazy child/history navigation and requester action; source plus 151 asset hashes unchanged; no listener warning |
| Real Vue/TypeScript tooling | Both initialize, actual document/type/HTML requests and tsserver bridge, shutdown and process close pass |
| npm audit gate | Zero reported vulnerabilities |

The selected native files run serially against disposable owned PostgreSQL 18
with pinned prerequisites. Observed process-plus-drain durations are HTTP 10.1s,
TLS 18.4s and driver 4.1s. These descriptive local observations are not a matched
speedup comparison or complete integration-inventory validation.
Browser process-plus-drain observations are 8.1s, 11.4s and 8.6s respectively.
These use Playwright 1.64.1 and its installed Chromium; other engines/platforms
remain outside this selected collection.

Private ignored evidence lives under .tmp/tests-stream-2026-10-19: original and
corrected warning traces, focused logs, final fast/audit results, immutable PR
bytes/lock review, language probe attempts and native/browser reports. Initial
probe import/semantic-routing/exit-write mistakes are retained and corrected;
they do not establish dependency regressions. Production secrets and raw private
test/error prose are not added to structured records or committed evidence.

## Reusable AI workflow and scope

Extend the existing testing skill with a conditional reporter-ownership reference
and the existing standards skill with Node/OWASP/W3C ownership mappings. Keep
the default standards workflow applicable to actual journeys; this is not a new
blanket compliance checklist. The dependency reference distinguishes Vue HTML/
document features from TypeScript plugin script/template semantics and requires
actual bridged requests plus shutdown/close.

This qualifies installed Windows Node 24.18.1 and selected current consumers.
It does not prove an accumulating leak, a memory saving, whole-CI speedup, every
integration/browser case, screen-reader behavior, WCAG conformance, Linux image
qualification or compatibility with all Node versions. npm audit is one check,
not a security certification. No branch, tag, release or PR merge is created.

The subsequent [Node 24.22.0 outcome](NODE_24_BASELINE_OUTCOME.md) qualifies a
common project/CI/Docker baseline with project-scoped host execution and actual
packaged Linux proof. The announced October 21 security patch remains future
work; consult the [dated recommendation](NODE_24_BASELINE_RESEARCH_2026_10.md).
Separately review the production build-tool dependency closure observed during
[PR 45 qualification](OPEN_PR_45_LOCAL_EVALUATION_OUTCOME.md).
