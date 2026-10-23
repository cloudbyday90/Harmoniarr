# Candidate reputation publication outcome

Recorded 2026-10-23. See the separate [design](CANDIDATE_REPUTATION_DESIGN.md), [official research and tradeoffs](CANDIDATE_REPUTATION_RESEARCH.md) and [Docker outcome](LOCAL_DOCKER_CANDIDATE_REPUTATION_OUTCOME.md).

## Finding and change

The pre-change PostgreSQL reproduction injected a ledger refusal through the actual candidate service and canonical trust mutator. It committed failed candidate state and one failure counter with zero ledger rows. A repeated terminal call then hit the status conflict, leaving no automatic repair path. The successful canonical reproduction and its durable-state assertions are retained in private evidence.

All five inventoried non-spectral producer paths now publish inside their owning transaction. The persisted candidate event UUID owns ledger and trust-history identity. Conditional candidate transitions and locked recovery episodes prevent replay; genuine later attempts create different event identities. Ledger failure and missing acknowledgement refuse publication rather than using a savepoint or swallowed post-commit callback. Recovery attempts, replacement/child intent, audit and episode also roll back with evidence.

A small ESM candidate publication service supplies an expiring event-bound queryable. It borrows the existing transaction through the shared snapshot mutator, preserving producer-to-snapshot lock order and fresh READ COMMITTED reads. The candidate service now uses the existing transaction runner, preserving the original Error/null even if rollback fails. Both regular app wiring and standalone service composition use durable persistence; injected in-memory projection adapters do not establish producer durability. Database Date timestamps are preserved instead of replaced with the current time.

Policy exclusions remain explicit: operator/environmental blockers and scheduled same-candidate rejection retries do not penalize peers. Advisory callbacks are returned for post-commit execution and awaited separately; their failure cannot undo durable evidence.

## Executed evidence

- Focused unit cohort: 52 passing tests covering candidate transitions, evidence projections and publication capability/refusal behavior.
- Isolated PostgreSQL 18.3: 20 new shared candidate cases, 15 existing spectral cross-writer/rollback cases and nine existing recovery transaction cases passed. The new cases include actual SQL ledger/snapshot refusal, Error/null rollback, foreign and duplicate identities, concurrent terminal/recovery observations, pruning/replay, distinct later attempts and real consumer exits on both sides of commit. Child close and server row-lock retirement precede retry and cleanup.
- Actual application composition plus recovery execution/positive handoff: 14 passing cases, including both application fixture entrypoints. The actual import module receives the activity evidence recorder and commits event-correlated ledger/counter state.
- Standards/testing skills passed their metadata validators. The updated [candidate publication reference](../.agents/skills/harmoniarr-web-standards/references/candidate-reputation.md) teaches the inventory, identity, transaction, exclusion, retention and evidence workflow. No independent agent forward-test was performed.

The final frozen code cohort contains 3,387 source files, fingerprint
`bfbb0185d41e12b53968a284fcfa2145e55e52365331bc3d35a39f65d02d3808`.
`validate:fast` passed **11,050 tests** (5,883 server, 4,470 client, 697 scripts),
lint, repository/migration/schema/ESM checks and both builds. The immutable
packaged image passed **35 PostgreSQL 18.6 cases** (twenty candidate and fifteen
spectral). The [Docker outcome](LOCAL_DOCKER_CANDIDATE_REPUTATION_OUTCOME.md)
records the no-cache rebuild, exact runtime comparison, healthy preserved-state
startup, existing administrator and readiness. Production and JavaScript test
bytes did not change after that gate. Two deployment verifier `.mjs` files then
replaced obsolete null-returning evidence stubs with the real transaction-capable
activity recorder; the file-backed verifier also asserts event-correlated success.
The first file-backed refusal is retained separately. All three touched deployment fixture files passed
syntax/lint checks and their coordinator/evidence unit cohort passed eight cases.
The controlled provider fixture also now honors requested search UUIDs, validates
IDs, preserves matching retries and rejects conflicting intent. Six actual HTTP
contract checks passed in an isolated provider container, including read/replay,
conflict, invalid identity and generated fallback identity; child close and container
removal were acknowledged. The final explicit changed-code manifest includes
three deployment `.mjs` files (eighteen code artifacts total); the cohort
fingerprint above excludes `.mjs`.

The file-backed walkthrough validator passed against the same immutable image,
including real FLAC add, quality/collision refusal, isolated mapping repair and
FFprobe recovery. It asserts exactly one applied-event-correlated ledger success.
Temporary project/container/network/volume and workspace absence were verified.

The broader controlled-provider pipeline did **not** pass: after correcting its
obsolete search-ID behavior it stops at the first download with
`music_queue_recovery_not_current` / current acquisition-authority refusal.
The same corrected fixtures fail at the same boundary on both the preceding
immutable image and the candidate. This establishes a retained validation gap,
not full controlled-provider acceptance. Inspection points to its ownerless
initial discovery setup; that is a follow-up hypothesis, not a completed root-cause
proof. Both refusal runs and the earlier identity failure are retained privately,
and their Compose resources were retired. Production authority checks were not
weakened.

## Recommendation and remaining scope

Adopt existing PostgreSQL transactions, event UUIDs, guarded publication scopes and shared snapshot admission, followed by advisory callbacks. This gives immediate consistent durable evidence without a new queue or application. The cost is that trust storage/lock failures can now reject a producer transition; callers can retry the guarded operation. Snapshot mutation remains serialized and rewrites the whole JSON snapshot.

SQL rollback does not reverse completed filesystem copies or remote transfers. Existing receipt and recovery guards still own reconciliation. This is not exactly-once notification delivery, a distributed transaction, an automatic historical backfill, or a new memory-sizing/security-conformance result. Producer guards own replay after ledger pruning; coherent restore is required and a missing ledger row does not authorize replaying a completed producer.

Next: bring the controlled-provider fixture's discovery/recipient setup into the
current acquisition-authority model, starting with the first ownerless discovery
seed. Prove authorized progress and revoked/missing-owner refusal on the same
fixture before restoring the full pipeline acceptance claim. Then measure snapshot
rewrite cost and contention to decide per-source persistence while preserving
manual trust/block decisions, retention and coherent restores.

GitHub MCP found no open PRs to choose or clean up. No PR was merged, branch created, version bumped, release or tag created. Private artifacts remain under `.tmp/candidate-reputation-2026-10-23/`.
