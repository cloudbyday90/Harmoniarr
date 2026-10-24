# Candidate revisions and current authority

Use for revision-backed candidate browsing or bounded restart qualification. Read
docs/CANDIDATE_SEARCH_REVISIONS_DESIGN.md, research and outcome in the active repo.

1. Inventory every SQL writer, including conflict updates, recovery/delivery
   modules, direct SQL and cascades. Service-only invalidation is insufficient.
   Candidate-file mutations are outside narrow page eligibility; revisit that
   boundary if policy inputs change.
2. Preserve atomic candidate/revision publication. Statement triggers deduplicate
   affected source keys, rotate both sides of a search move and handle TRUNCATE.
   Test populated backfill, fresh snapshot, enabled trigger/function anchors,
   zero-row writes, conflict updates and rollback. A timestamp or allocated
   sequence maximum does not establish committed search identity.
3. Bind the durable revision into authenticated navigation context and check it
   before and after bounded scanning. Missing or changed evidence uses the
   existing refresh conflict. Do not disclose internal search/revision facts.
4. Observe real PostgreSQL waits independently. Same-search writers serialize;
   prelocked candidates and revision rows can form a cycle. Statement-local key
   sorting is not a transaction-wide lock order. Preserve abort/rollback evidence;
   never silently replay provider effects to hide a database failure.
5. Keep full fresh command guards until a separately qualified protocol covers
   source mutations, current actor/participant/policy/track facts, expiry, replay,
   audit atomicity and starvation. A revision or historical empty cursor is not
   an exhaustion certificate. Reusing existing operation runs is the preferred
   built-in direction for bounded durable progress, not implemented authority.
6. Retain the existing explicit refresh/status/focus lifecycle; prove a real stale
   cursor refresh in the browser. Automated keyboard results do not complete
   deferred screen-reader or physical-device acceptance.

Use the shared testing/server/candidate-search-revision-fixture.js on isolated
PostgreSQL and the guarded packaged native entry. Keep revision contention proof
separate from physical query plans, media qualification and RSS bounds. Transition
relations consume database storage, retained revisions grow with search history,
and two indexed reads add work per page; state these costs explicitly.
