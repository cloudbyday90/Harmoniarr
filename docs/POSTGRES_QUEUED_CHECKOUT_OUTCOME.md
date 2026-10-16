# PostgreSQL queued checkout outcome

Date: 2026-10-16. Scope: owned integration diagnostic infrastructure.

Implemented the [design](POSTGRES_QUEUED_CHECKOUT_DESIGN.md) in focused ESM queue,
record and driver-policy modules. The [official research](POSTGRES_QUEUED_CHECKOUT_RESEARCH_2026_10.md)
records alternatives, pros/cons and the recommendation stack. Production code,
database schema, dependencies, pool/deadline limits and release state are unchanged.

## Implemented result

Version-three fixture checkout records retain existing pool, error, phase and
connection fields and add approved acquisition stages/offsets. Queued cold clients
now follow the actual PendingItem through promotion, including promotion caused
by another connecting client's failure. Reused clients have acquisition evidence
without invented startup milestones. Unknown items and unsupported/custom driver
surfaces cannot borrow another checkout's connection owner. Descriptor restoration
attempts each owned surface and preserves a later owner's method.

The maintained testing-validation and web-standards skills now route to this
boundary and its native controls. Both pass skill-creator structural validation;
that check does not certify agent behavior or general standards conformance.

## Validation and retained failure

Final source: eight changed/new JavaScript files, 3,014 total source inputs,
SHA-256 `5f4fa839db57a6451397404add86626a9f0b00e7253142f9b66d5b041a3e3034`.
Opening and closing native fingerprints match. Private records, source freezes
and logs are retained in `.tmp/queued-checkout-2026-10-16/`.

| Final check | Result | Scope |
| --- | --- | --- |
| Focused diagnostic unit tests | 30 passed | Privacy, callback/promise outcomes, Error/null, mapping refusal and restoration |
| validate:fast | 10,461 passed; both builds and static/lint/hygiene checks passed | 5,406 server, 4,384 client, 671 scripts; zero failed/cancelled/skipped; 114.884 seconds |
| Selected native diagnostic v3 | 31 passed in seven files; zero failed/cancelled/skipped/TODO | 142.863 seconds excluding preflight/final source checks; each file returned exit 0 without a signal |
| Complete canonical integration gate | Not rerun | 127 files remain, with two additional native controls; 120 files are outside this selected collection |

The native selection covers fixture-pool-checkout (7), app-checkout-diagnostics
(3), postgres-startup-server (4), postgres-startup-cancellation (4),
postgres-runtime-startup (2), library-media-request-atomic-creation (6) and
library-scan-receipt-invalidation (5). It includes both application fixture
entrypoints, schema startup, actual PostgreSQL acquisition/query reuse, real
startup hold and cancellation. The new failed-promotion control uses owned
loopback TCP sockets to hold startup; it does not pretend that those sockets
authenticate against PostgreSQL.

Candidate native collection v1
retains an existing direct-timeout control's later readiness-probe failure:
expected accepting, actual failed. All six other cases in that file passed,
including both new native queued promotion controls and both app entrypoints.
The collection stopped before admitting the remaining six files. It is not a
passing selected collection or a diagnosis of the two earlier full-run failures.

Only the assertion's bounded readiness detail was added after that collection;
the healthy-readiness assertion and 2-second probe limit remain unchanged. V1
used source `815cf05be7a7812bd6aeb357363691714bd852c8543fee2ffa689c72d8335a70`.
Its original probe detail was not persisted, so its cause remains unknown.
The separate v2 collection passed that unchanged assertion and all selected
files on source `c5b4bd1ca6475bc33ef72bdde0b00655e576d57b378aa08c87cfd8a2ecefd2aa`;
it does not erase v1. Final review then tightened the unsupported custom-method
fallback to suppress even synchronous construction attribution, with an additional
regression test. V3 repeats the selected native collection on the final source.
V2 evidence and the earlier 10,460-case fast pass remain separate, not added to
the final totals. Elapsed differences between collections are not a matched
performance result. The native TestsStream listener warning and existing
225 Vue test warnings remain visible; they did not fail the final checks.

The [earlier broad-run failures](WANTED_ROOT_TEST_LANES_OUTCOME.md) remain failed
collections. Fresh success in their two files does not diagnose the original
unobserved HTTP wait or matched startup/no-authentication gap. No retry, timeout
increase, pool expansion, skip or scheduling promotion was implemented.

Opening and closing GitHub MCP open-PR collections were empty, so no random PR
or stale PR operation applied. Main remains the working branch; no release/tag
was created. The [local rebuild outcome](LOCAL_DOCKER_QUEUED_CHECKOUT_OUTCOME.md)
records the completed no-cache walkthrough rebuild, retained state and successful
readiness-only proof separately from integration validation.

## Recommendation stack and next item

Keep explicit version-reviewed pending ownership, bounded sanitized records,
fixed resource limits and targeted native adverse controls. The benefit is
original-client evidence across queued promotion; the cost is internal-driver
version maintenance. Keep public counters as context, rather than a causal
diagnosis. The [design's options table](POSTGRES_QUEUED_CHECKOUT_DESIGN.md#options-and-recommendation-stack)
records the rejected ambient/global-tracing and capacity alternatives.

Next: instrument the original startup write's local completion separately from
authentication/server receipt, with a real held-startup control and reviewed
owned-stream restoration. Local write completion still cannot prove remote
receipt. Carry HTTP request-phase attribution as a separate fixture boundary.
Missing server association, clipped windows and later healthy probes cannot be
used as causal proof. Revisit complete-gate scheduling only after these gaps have
actionable failure evidence.
