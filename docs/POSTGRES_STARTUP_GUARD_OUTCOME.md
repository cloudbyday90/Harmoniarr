# PostgreSQL post-start cleanup guard outcome

Date: 2026-10-15. Work is on main; no new branch, release, tag or PR merge.

## Delivered behavior

The shared runtime establishes its bounded server-close callback immediately
after an owned start returns, then reads connection metadata inside its existing
setup guard. Getter and port-coercion failures now await one stop attempt before
returning the exact original Error/null. Container-ID, evidence construction and
template preparation retain their previous guarded behavior.

The startup failure path now catches both synchronous and asynchronous stop
errors. A failed stop remains uncertainty; it cannot replace the setup failure
or grant removal authority. Failed starts do not gain an unacknowledged owner,
and borrowed-server failures never allocate or stop a container. Successful
runtime lifetime, strict release and canonical cleanup behavior are unchanged.
No production service, schema, dependency, pool bound or resource deadline changed.

## Executed evidence

The 40-case container-free regression run initially had 12 passes and 28 failures:
metadata/coercion paths omitted stop, held-stop cases returned too soon, and
synchronous stop observation could replace the primary setup failure. After the
correction, all 128 focused runtime, owned-parent, strict-release, lifetime, app
and workspace tests passed, zero skips, in 20.638 seconds of runner time.

The six selected native cases passed with zero failures/cancellations/skips in
25.668 seconds of runner time. Two new cases use freshly started PostgreSQL 18
containers with a controlled host-getter Error or port-coercion null failure.
The wrapper/direct entrypoints stay pending while the guarded stop is held.
An independent client successfully queries the acknowledged real server during
that hold, then disconnects before release. The stop completes physically, its
adapter deliberately rejects afterward, and the exact original setup failure
still returns. One stop attempt, no template/scenario dispatch and absence of the
exact owned container ID are verified.

These are injected metadata and post-stop adapter faults around real lifecycle
work, not reproduced Testcontainers transport or PostgreSQL metadata incidents.
The remaining four native cases preserve normal empty/template startup, mixed
scenario/tail drainage and the earlier controlled stop-refusal contracts. Actual
test operations are registered and drained beyond runner cancellation. No large
SQL/media/scaling or intentional cold-checkout timeout matrix was repeated.

The complete fast gate passed 10,305 cases (5,353 server, 4,384 client and 568
script), zero failures/cancellations/skips, plus static checks, lint and both
builds in 123.235 seconds. JavaScript remained unchanged through native and fast
validation. These elapsed observations do not establish a matched speedup.
Production dependency audit reports zero known vulnerabilities.

Both repository skills and the installed standards skill passed structural
validation; all four installed standards files match repository bytes. Three
final JavaScript hashes match staged bytes, 95 previously frozen source files
remain unchanged, and 718 local links in ten changed Markdown documents resolve.
Staged whitespace checks pass. This focused reference update does not claim a new
blind skill trial. Private evidence is ignored under
`.tmp/postgres-startup-guard-2026-10-15/`.

## Recommendations and next item

Recommended stack: acknowledged container → guarded metadata/evidence/schema
setup → one awaited bounded stop on failure → primary-value preservation →
existing published runtime lifetime → independent native retirement proof. It
closes the ownership gap without another lifecycle service; failed startup now
waits for its bounded stop attempt. See the separate
[official research and pros/cons](POSTGRES_STARTUP_GUARD_RESEARCH_2026_10.md).

The standards/testing skills receive a focused guard-boundary method. W3C/OWASP
data minimization applies to evidence; no browser/WCAG, blanket security or
whole-suite performance certification is claimed.

Next: review cancellation while startup is in flight. Empty-schema startup only
checks pre-abort before acquiring a container; a signal changing during that
await does not itself throw inside this new guard. An injected direct-creation
control returned a runtime without a pre-publication stop after both Error and
null abort reasons; the test separately cleaned its fake owner. It created no
native server and does not diagnose an actual cancelled PostgreSQL startup.
Evaluate post-acquisition and pre-publication checkpoints with owned release,
original Error/null and actual completion. Preserve the distinct borrowed/template
cleanup contracts and do not race cancellation against resource disposal. Hosted
Ubuntu canonical media evidence remains separate before media-default promotion.

The subsequent [startup cancellation outcome](POSTGRES_STARTUP_CANCELLATION_OUTCOME.md)
completes that checkpoint/release follow-up. The original probe above remains
historical evidence from before the correction.

Initial and final GitHub MCP collection reads found zero open PRs. No applicable
random PR or stale PR was available to implement or rebase. No PR comment, merge
or other external message occurred.

See [design](POSTGRES_STARTUP_GUARD_DESIGN.md).
