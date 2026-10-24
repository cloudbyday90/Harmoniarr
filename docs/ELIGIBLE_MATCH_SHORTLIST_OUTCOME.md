# Eligible alternatives before the cap: outcome

Implemented October 24, 2026 on main. See the [design](ELIGIBLE_MATCH_SHORTLIST_DESIGN.md)
and [official-source research, tradeoffs and stack](ELIGIBLE_MATCH_SHORTLIST_RESEARCH.md).

## Delivered behavior

Missing Music now filters current quality-review alternatives before applying the
existing twelve-choice cap. A valid match beyond fifty-one higher-scoring ineligible
rows appears in the existing Choose another match disclosure and can be selected.
Search again remains unavailable while an eligible alternative exists.

A narrow ESM candidate-fact store replaces the old ID-only query and per-candidate
detail/file reads. It reads fifty-row UUID keyset batches with the policy inputs
and choice facts needed by the shared scope. The same scanner serves the bounded
shortlist and the guarded restart's one-match existence check. A detail request
shares one scope/scan result for choices and exhaustion permission.

Only file count, formats, size and candidate ID enter the public choice shape.
Measured-review selection no longer requires membership in the old raw shortlist.
It validates identifiers, prechecks candidate source/recipient eligibility before
candidate locks, and retains fresh authority under canonical write locks. Ordinary
non-review selection keeps its existing shortlist rule.

Selection, event and required audit remain atomic. The failed acquisition, quality
floor, consent and source bytes are retained. Selection starts no download; the
refreshed release uses the existing explicit download action. No new UI command,
endpoint, dependency, migration, application, branch, version bump, tag or release
was introduced.

## Executed validation

- Focused scope/store/projection/command/decision/module checks: 37 passed.
  Query-count checks establish one scope read, two fifty-row page reads for the
  hidden-choice example, no per-alternative detail/file calls, early existence
  termination and complete exhaustion traversal. Foreign candidate scope cannot
  open a transaction or acquire candidate locks.
- Full fast gate: **11,080 passed** (5,907 server, 4,473 client, 700 script), with
  zero failures, cancellations or skips. Lint, copyright/ESM/schema/Compose policies
  and client/server builds passed.
- Real PostgreSQL/HTTP cohort: 16 passed, including three new shortlist scenarios
  and existing six selection/seven restart scenarios. The new cases prove actual
  exclusion from the legacy shortlist, own-recipient selection, replay, malformed
  and foreign refusal, public-field bounds, batch/full-candidate policy parity,
  stable twelve-choice output and stale policy/shared-account refusal. Existing
  rollback, concurrency, actual lock waits and durable quality-floor proof remain
  green. The failed source bytes stay intact and no transfer/apply run is created.
- Real-app browser cohort: five passed. The new case uses actual HTTP/SQL data with
  fifty-one higher-ranked ineligible rows, native keyboard disclosure, owned focus,
  selection feedback, explicit download readiness and reload. Existing quality
  review, recheck, selection and Search again cases also passed.
- Updated standards/testing skill references passed the skill-creator validator.
  Source was frozen before the stable fast gate; line endings were preserved to
  keep the patch focused.

These fixtures use controlled candidates and an injected media gate. They establish
scoped UI/HTTP/SQL behavior, not public provider discovery or measured audio.
Packaged media and preserved-state rebuild evidence are separate in the
[Docker outcome](LOCAL_DOCKER_ELIGIBLE_SHORTLIST_OUTCOME.md). Screen-reader and
physical-device acceptance remain deferred manual checks.

GitHub MCP found zero open PRs at initial selection and recheck. No applicable
random PR, merge or stale-PR rebase was available.

## Recommendation and next item

Keep the existing Vue disclosure and mutation owner, bounded fact projection,
shared ESM policy/scanner, narrow PostgreSQL store and transactional selection.
This repairs the demonstrated hidden-choice path while eliminating alternative
detail/file queries. Sparse eligible searches can still require full traversal;
the shortlist remains twelve choices and uses stable UUID order rather than raw
score order.

Next: **browse additional eligible choices beyond twelve** if broader comparison
is needed. Use scoped keyset cursors with current-search/policy invalidation,
bounded page reads and preserved focus/refresh behavior. Keep eligibility and
selection authority shared; do not restore a raw-score shortlist membership gate.
