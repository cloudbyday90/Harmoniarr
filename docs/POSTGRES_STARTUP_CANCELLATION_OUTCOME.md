# PostgreSQL startup cancellation outcome

Date: 2026-10-15. Work stays on main without a new branch, release, tag or PR merge.

## Delivered behavior

The shared ESM fixture owner now checks cancellation after acknowledged container
start, before metadata access, and after runtime creation immediately before
publication. Owned and borrowed setup converge on one publication guard. Once
created, the runtime owns template/server cleanup; failure uses that canonical
cleanup rather than a second outer server-stop attempt. Before that transfer,
only the acknowledged server's bounded close callback is available.

Cancellation waits for actual start/preparation and release. Actual acquisition
or preparation failures retain precedence over a simultaneous abort. A cancelled
successful acquisition rejects with the exact reason, including null, after
awaited cleanup; secondary synchronous/asynchronous release errors do not replace
it. Borrowed server ownership is unchanged. Successful publication leaves
explicit cleanup with the caller, with no persistent abort-disposal listener.

No production service, schema, dependency, default scheduling, pool bound,
resource deadline or retry policy changed. The implementation remains in its
existing small owner rather than adding a duplicate lifecycle service.

## Evidence

The new 30-case container-free regression run initially had 18 passes and 12
failures. The failed controls covered in-flight start, returned-template and
empty-runtime publication cancellation. The corrected focused gate passed all
168 cases across the new cancellation contracts, startup guard, runtime cleanup,
lifetime, strict database release, template, app and workspace owners, zero
failures/cancellations/skips, in 33.908 seconds of runner time.

All ten selected native cases passed with zero failures/cancellations/skips in
200.935 seconds of runner time under shared host load. Four new controls use
fresh PostgreSQL 18 owners: two cancel while actual successful container start
is held before acknowledgement, and two hold an actual prepared template before
returning it to owned/borrowed runtime startup. The startup controls prove no
metadata/preparation after cancellation, pending rejection through held stop,
continued native queries, observer disconnect and exact container retirement.
The template controls inspect the same sealed template identity during held
release, prove release before owned stop, and verify the borrowed server remains
queryable with that template absent. Deliberate post-release adapter errors do
not replace Error/null abort reasons or cause a second stop.

The remaining six cases retain existing real metadata-failure cleanup,
scenario/tail drainage and controlled stop-refusal coverage. Actual returned
operations are registered and drained beyond test cancellation. These are
controlled holds/faults around actual database work, not diagnoses of prior
PostgreSQL or Docker incidents. No unrelated scaling, media or intentional
cold-checkout timeout matrix was repeated.

The complete fast gate passed 10,335 tests (5,383 server, 4,384 client and 568
script), zero failures/cancellations/skips, plus static policies, complete lint
and both builds in 204.737 seconds. The client build completed in 3.99 seconds
and emitted a plugin-timing diagnostic; there was no failed build or check.
JavaScript stayed unchanged through native and fast validation. These timings
under shared host load are observations, not a matched speedup or CI guarantee.

Production dependency audit reports zero known vulnerabilities. Repository
testing/standards skills and the installed standards skill structurally validate;
the installed standards skill's four maintained files match repository bytes.
All three final JavaScript hashes match staged bytes, 97 previously frozen
source files remain unchanged, and 726 local links in ten changed Markdown
documents resolve. Staged whitespace checks pass.
These focused reference updates are not a new blind skill trial or general
accessibility/security certification. Private logs and source manifests remain
ignored under `.tmp/postgres-startup-cancellation-2026-10-15/`.

## Recommendations and next item

Recommended stack: cooperative AbortSignal checkpoints → acknowledged owner →
one runtime publication guard → canonical template/server cleanup → exact
primary value → minimized diagnostics → focused contracts and native proof.
Benefits are explicit authority and a small review surface; cancellation must
wait for real acquisition and bounded release. Abort races and persistent
automatic disposal were rejected for this slice. See the separate
[official research and pros/cons](POSTGRES_STARTUP_CANCELLATION_RESEARCH_2026_10.md).

Next: measure the existing five-file shared PostgreSQL cohort against the same
serial isolated cohort, using matched file order and identical cases. Separate
container startup, schema preparation, scenario and release phases; require zero
skips, complete registration/cleanup and unchanged private results. Keep dedicated
lifecycle/cancellation/migration tests on fresh owners. Use the measured result
to decide whether any default scheduling change is justified; this correctness
fix alone makes no whole-suite speed claim. The cohort's current allowlist is in
testing/integration/postgres-test-cohort.js. The earlier
[Wanted/recovery result](WANTED_RECOVERY_SHARED_POSTGRES_OUTCOME.md) measured a
single baseline-first two-file pair and separately passed the public five-file
profile; it does not establish the current complete cohort's paired benefit.
Include reversed ordering on this hardened baseline before considering defaults.
Hosted Ubuntu canonical-media evidence
remains a separate prerequisite before media-default promotion.

Opening and final GitHub MCP collection reads found zero open PRs. No applicable
random or stale PR was available to implement or rebase. No PR comment, merge or
other external message occurred.

See [design](POSTGRES_STARTUP_CANCELLATION_DESIGN.md).
