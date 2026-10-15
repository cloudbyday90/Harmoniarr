# Shared PostgreSQL runtime lifetime outcome

Date: 2026-10-15. Work is on main; no new branch, release, tag or PR merge.

## Delivered behavior

The shared runtime now reuses the existing per-owner lifetime module. A scenario
is registered before its queued work starts. Cleanup synchronously closes
admission, drains every full returned operation, then releases the template and
owned server. Late requests reject with fixture_runtime_closed before evaluating
per-call options, creating captures or invoking a delegate/callback.

The scenario retains its exact result or Error/null rejection. Cleanup retains
its own canonical promise and template/server failure policy; a failed scenario
cannot short-circuit a sibling's drain. Strict empty-schema release, template
ownership, borrowed-server boundaries, pool sizes and all existing deadlines
remain intact. App/workspace barriers and identity/quiescence predicates keep
their separate responsibilities. No production service, schema or dependency
changed, and the shared lifetime module itself was reused without alteration.

## Executed evidence

All nine new container-free contracts failed on the original implementation.
After the barrier was wired in, the focused shared-runtime, strict-release,
stop-failure, app and workspace cohort passed 83/83, zero skips, in 18.321 seconds
of runner time. Immediate same-turn cleanup still allows previously admitted
queued work to finish in both schema/source combinations. Two held tails,
late-option refusal, Error/null, cleanup-failure identity and successful results
are tested through the shared owner.

The selected native cohort passed 19/19, zero failures/cancellations/skips, in
74.883 seconds of runner time (74.977 seconds including invocation). Its two new
cases each own a fresh PostgreSQL 18 server and two real isolated databases.
One body holds its real pool, queries again after cleanup starts, then rejects
with the original Error/null. Its sibling completes successfully but holds the
returned admin-close tail after the physical client disconnects and database
DROP. Neither a callback return nor the first rejection starts container stop.

Both target databases are verified absent while the final tail is held and the
server remains queryable. Late work is refused without another database delegate.
The independent observer disconnects before releasing that tail; the successful
sibling returns its original result, one bounded stop runs and the exact owned
container ID is verified absent. Actual native operations are registered and
drained beyond test-runner cancellation. The other 17 cases retain real template
identity/permission/source checks, strict-release refusal, stop failure and
checkout-context/callback/promise acquisition proof across both app entrypoints.

The complete fast gate passed 10,265 cases (5,313 server, 4,384 client and 568
script), zero failures/cancellations/skips, plus static checks, lint and both
builds in 154.628 seconds. JavaScript remained unchanged through native and fast
validation. These are elapsed observations, not matched speedup measurements.
Production dependency audit reports zero known vulnerabilities.

Both repository skills and the installed standards skill passed structural
validation; four installed standards files match repository bytes. All three
final JavaScript hashes match staged bytes, 93 previously frozen source files
remain unchanged, and 711 local links in ten changed Markdown documents resolve.
Staged whitespace checks pass. This reference update does not claim a new blind
skill trial. Private evidence is ignored under
`.tmp/postgres-lifetime-2026-10-15/`.

## Recommendations and scope

Recommended stack: synchronous shared admission → existing per-owner registry
→ full delegate completion → allSettled drainage → strict database/template
release → bounded owned stop → independent workspace guards. The benefit is
correct release ordering with a reused small ESM owner. The tradeoff is that
cleanup must wait for genuinely pending work; a timeout or cancellation signal
cannot grant disposal authority. Hidden detached work and self-awaiting cleanup
inside an admitted callback are outside this contract. This is correctness proof,
not a whole-suite speedup or browser/WCAG certification claim.

Next: inspect startup ownership immediately after container start. Connection
metadata is currently read before entering the server-release try/catch. A
controlled injected getter reproduced one acknowledged start and zero stops for
both original Error and null failures. No native server was launched; this does
not diagnose an actual PostgreSQL metadata failure. Keep startup primary
Error/null, bounded stop and exact server ownership when evaluating a broader
post-start cleanup guard. Hosted Ubuntu canonical-media evidence remains separate
before media-default promotion.

Initial and final GitHub MCP collection reads returned zero open PRs; no
applicable random PR or stale PR was available to implement or rebase. No PR
comment, merge or other external message occurred.

See [design](POSTGRES_RUNTIME_LIFETIME_DESIGN.md) and
[official research, options and pros/cons](POSTGRES_RUNTIME_LIFETIME_RESEARCH_2026_10.md).
