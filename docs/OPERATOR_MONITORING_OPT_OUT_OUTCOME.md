# Operator monitoring opt-out outcome

Completed October 12, 2026, America/New_York, on main. See the
[design](OPERATOR_MONITORING_OPT_OUT_DESIGN.md) and
[official research](OPERATOR_MONITORING_OPT_OUT_RESEARCH_2026_10.md).

## Behavior and implementation

Saving an unmonitored policy now completes its queued reconciliation without
creating policy-derived acquisition work. The shared ESM desired-state service
requires `isMonitored === true` for policy eligibility, reports
`artist_unmonitored`, and the execution summary forwards `unmonitoredBlockedCount`.
Execution, direct Wanted projection and the final transaction guard reuse this
decision. A caller's eligible flag cannot bypass current unmonitored policy.
The two existing runtime modules own the correction; no new policy engine,
singleton, route, schema or operation system was introduced.

Explicit-selection exceptions retain their existing behavior. The normal save
still requires monitoring for selections/overrides, and valid monitored explicit
consent publishes under manual-only/track-only policy. Existing acquired,
duplicate, active request and discovery blocker precedence remains; the counter
reports the primary blocker rather than every applicable denial. A saved opt-out
does not delete or cancel an existing request, event, discovery row or acquired
file. Backend summary evidence does not establish rendered accessibility.

## Reproduction and corrections

The pre-fix native file passed 1/4 and failed 3/4, with zero cancellations/skips.
Two cases reproduced actual requests from snapshot revision 2 after a saved
opt-out: normal planning and a forced eligible flag against unchanged source.
The third failure was an invalid positive-path fixture with an empty release-type
list; it was corrected to a valid nonempty list, retaining restrictive automation
and explicit selection. Existing-request preservation already passed.

A pre-fix focused diagnostic passed 31/50. It included new policy/counter
expectations and a fixture that attempted to mutate captured frozen source.
The first post-fix diagnostic passed 59/60 with that same fixture mistake. Clone
the source before constructing the unchanged-unmonitored guard scenario; runtime
capture immutability remains intact. These candidates are separate from final
proof and are not represented as all product defects.

## Final validation

Seven JavaScript files were frozen before complete gates, including two runtime
modules and five test files. Working/index hashes remain exact after documentation
maintenance. Private logs, manifests and candidate hashes live in the ignored
`.tmp/operator-monitoring-opt-out-2026-10-12/` directory.

| Gate | Final result | Local duration / scope |
| --- | --- | --- |
| Focused policy/consumers | 258/258, zero failures/cancellations/skips | 37 verified literal files; TAP 1.555 seconds |
| Complete `validate:fast` | 9,884/9,884 plus both builds | 4,948 server + 4,384 client + 552 script tests; wrapper 146.804 seconds |
| Affected native PostgreSQL | 61/61, zero failures/cancellations/skips | 9 verified files, 5 suites plus standalone tests; TAP 127.202 seconds, wrapper 127.288 seconds |
| Dependency audit | Zero reported vulnerabilities | `npm audit`, dependency inventory only |
| Skills | Three structural validators pass; all four installed standards files match source hashes | Concrete reference maintenance, no new blind skill trial |

Native selection: monitoring opt-out, publication authority, reconciliation worker
lifetime/recovery, save revision, transactional Activity, post-save failure,
Wanted reconciliation and metadata refresh lifetime. Four new native cases use
real canonical saves/queue claims, worker acquisition/completion/close and SQL
publication; assertions read durable rows outside swallowed callbacks. The Wanted
reader uses an owned transaction queryable. Pool max 2, checkout 10 seconds,
scenario 90 seconds, serial file isolation and existing teardown remain intact.
The acknowledged media image was
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`;
network-disabled ffmpeg/ffprobe checks returned 8.0.1. No exhaustive native,
benchmark speedup, Docker deployment or full security/WCAG certification is claimed.

## Recommendation stack and next item

Use scoped saved policy → shared eligibility → transaction-owned current source
and target rechecks → atomic request/event → actual completion and drainage.
Benefit: the opt-out is enforced consistently without conflating monitoring and
explicit intent. Cost: absent/non-boolean monitoring flags fail closed, so adapters
and fixtures must state their intent; existing request cancellation is separate.

Next: distinguish positive track consent from suppression and unresolved remap
state when granting explicit-policy exceptions. Source tracing and a direct
effective-state/planner probe with monitoring true, manual-only/track-only policy,
no explicit release selection and one resolved `isDesired: false` override returned
desired count 0, suppressed count 1, yet one eligible release classified explicit.
This is a planner-level finding, not native saved-flow proof. Reproduce a valid
saved suppression-only case and trace downstream track enforcement before fixing
it; preserve valid resolved desired tracks and manual release selections.
Projection-reader source enrollment and catalog lock partitioning remain later
coordination work. Historical unrelated PostgreSQL reset causes stay unconfirmed.

The [PR applicability outcome](OPEN_PR_APPLICABILITY_MONITORING_OPT_OUT_2026_10_OUTCOME.md)
records unchanged open revisions, all previously replayed locally. No additional
applicable random replay, PR merge, branch, release or tag was created.
