# Empty external-search recovery outcome

Completed 2026-10-20 on main. See the separate
[design](EXTERNAL_EMPTY_SEARCH_DESIGN.md),
[official research, pros/cons and recommendation stack](EXTERNAL_EMPTY_SEARCH_RESEARCH_2026_10.md),
and [Docker outcome](LOCAL_DOCKER_EXTERNAL_EMPTY_SEARCH_OUTCOME.md).

Confirmed published empty provider results now expose Search again through the
existing approved-request recovery command, after a six-hour cooldown and within
a two-command fresh-search budget. Candidate filtering and unavailable provider
evidence do not qualify as empty results. The response adapter's qualified outcome
passes through actual ingestion; the approved intent records database observation
time once per run inside the guarded persistence transaction.

One additive migration introduces the durable observation and counter with paired
observation and budget constraints. Schema snapshot and startup anchors include
them. The narrow ESM store owns SQL; shared pure policy owns projection arithmetic.
Worker starts and terminal summaries clear stale failure/outcome fields so a later
failure cannot inherit earlier empty-search evidence.

Cooldown and remaining budget survive Retry, expiry/absence, restart and operation
history retention. Every accepted fresh command after the first empty observation
consumes a slot, even if provider work later fails. Replays consume none. New-run
creation, pointer change, old-run supersession, counter and required audit are
atomic under the existing current-recipient/request/intent/run locks. Accepted
predecessor replay resolves before policy refusal. Existing fresh-admin, CSRF,
rate-limit and durable idempotency boundaries remain in force.

The review shows a semantic deadline, remaining searches and a bounded blocked
reason. Refresh reveals current eligibility without stealing focus. There is no
automatic submission, budget reset or browser clock authorization. Uncertain
commands retain their original key and expected run even when newer review state
blocks a new search. Definite policy errors get fixed public messages.

Validation used Node 24.22.0/npm 12.0.2:

- Complete `validate:fast` passed: 5,586 server, 4,398 client and 697 script tests
  (10,681 total), zero failures, cancellations or skips, plus static checks, full
  lint and both builds. Server/client/script test phases took 66.0/6.9/4.7 seconds.
- The affected PostgreSQL/HTTP cohort passed all 48 cases in 99.1 seconds: seven
  recovery, six discovery lifetime, 13 approval/review and 22 collection cases.
  After strengthening the new fixture to use the actual queue claim and Retry
  service, all seven recovery cases passed again in 24.0 seconds with unchanged
  deadlines/resource limits. Focused lint and test-hygiene also passed afterward.
- The new owned native HTTP case uses real sessions, PostgreSQL, actual slskd
  client/service, continuation and ingestion. It confirms final zero counts/body,
  early refusal, unchanged observation through real queue/Retry, actual missing
  saved-search refusal, six-hour eligibility, concurrent command coalescing,
  exact replay, exhaustion, three distinct reservations/POSTs and two required
  recovery audits. Fixture-owned database timestamps advance the cooldown; the
  test does not sleep for six hours. No import candidate or transfer is created.
- Required audit failure rolls back the counter along with the replacement run,
  pointer and supersession. Existing authorization, target-change, maintenance,
  disabled-recipient lock wait and stale Retry contention cases pass.
- Nine browser cases passed, zero failures/cancellations/skips, in 35.3 seconds.
  The real application shell uses controlled feature projections to prove deadline
  and remaining-budget display, unavailable actions, Refresh focus, keyboard
  activation, pending feedback, uncertain replay and optional refresh failure.
  The existing 390-pixel recovery screenshot was inspected: no overflow observed.
  Screen-reader announcements and full WCAG conformance were not tested.
- The existing web standards AI skill now routes to a focused empty-search policy
  reference covering evidence, durable resource limits, replay ordering and
  proportional validation. Skill structural validation passed.

Retained development failures: the first browser case used the wrong accessible
Refresh name; an existing worker expectation needed the intentional cleared fields;
the stronger Retry fixture initially omitted the queue claim's attempt increment.
These were corrected without increasing timeouts or weakening production guards.
The original broad and final focused logs remain private under
`.tmp/external-empty-search-2026-10-20/`.

Final source fingerprint: 3,152 files,
`57062708cc8fbaae0a8fa973719ee707cf862a16fbbb551eb08afaf5c733e6ba`.
The full fast gate and Docker image use the final runtime bytes. The only later
code change strengthened the integration fixture; its final seven-case database
gate and focused lint passed. Final byte/link/staging verification covers all
23 changed code/schema/test files.

PR #48 remains unapplied: fresh MCP metadata/patch, package/lock and installed Vue
consumer checks match the retained failing TypeScript 7 candidate and passing
TypeScript 6 control. No dependency, separate branch, PR merge, release, version
or tag was created.

Next: expose bounded reasons when provider responses produce no usable candidates
after filtering. Link that evidence to the existing release/quality decisions so
an operator can correct the cause before requesting more provider work. Keep this
distinct from confirmed empty searches; do not silently reset their budget.
