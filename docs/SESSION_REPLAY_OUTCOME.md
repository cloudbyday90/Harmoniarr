# Session replay transaction outcome

October 27, 2026. Implemented on main without a release, tag or separate branch.

## Delivered behavior

Detected rotated-token replay now delegates from `auth.js` to three narrow ESM
modules: a transaction owner, SQL store and policy/audit service. Family revocation
and its required event commit together. Audit failure rolls revocation back;
completed repeated replay does not add an event. The owning UPDATE rechecks the
server-observed token, owner/family, revoked/replaced state, expiry and enabled owner.

The independent owner deadline is 8 seconds, including checkout. Transaction-local
limits are lock 1s, statement 3s, idle transaction 3s and transaction 5s. Before
COMMIT dispatch, expiry prevents later publication. During COMMIT, a transport
failure remains uncertain; there is no automatic retry or claimed rollback.
Unknown clients are retired through actual transport close before pool release.
Failure returns a fixed 503 `session_replay_unavailable`, with the original cause
kept private. A disconnected browser does not abandon a detected security action.
Malformed audit IPs, including IPv6 zone IDs accepted by Node but unsuitable for
PostgreSQL INET, become null; request metadata cannot use that conversion failure
to veto revocation. Forwarded addresses remain unauthenticated audit evidence.

## Executed verification

Focused command: `node --test test/server/session-replay.test.js test/server/auth.test.js`
passed 18 tests. The final fast gate ran all `validate:fast` stages, with server
test concurrency 8: 6,236 server, 4,503 client and 703 script tests, **11,442 total**;
zero failures, skips or cancellations. Lint, ESM, copyright, migration/snapshot/
anchor contracts, Compose policies, hygiene and production build passed.
`npm run validate:security:npm` reported zero advisories.

The immutable fresh Docker candidate passed three separate native entries:

- `test/native/session-replay.test.js`: thirteen scenarios covering atomic success/
  repeat, twelve concurrent replays/one audit, required-audit failure rollback,
  family-row and audit-table lock timeouts, current-token/owner/identity refusal,
  real statement timeout, owner-deadline backend retirement/rollback, controlled
  lost commit acknowledgement, exhausted pool, HTTP disconnect ownership, and
  real HTTP refusal of both replayed parent and revoked child, and malformed
  forwarded IPv4 text/IPv6 zone metadata unable to prevent revocation.
- `test/native/session-pool-admission.test.js`: all ten existing admission,
  current-role, cancellation, native retirement and refusal controls.
- `test/native/schema-diagnostics-http.test.js`: actual reader, fresh access,
  revocation, no-store, bounded admission and unchanged catalog/ledger controls.

Each entry ran with network disabled, read-only root, UID 1000, 2 CPUs, 3 GiB
memory/swap, PIDs 256 and private tmpfs database/storage. Every container exited 0,
was removed and had its exact identity's absence verified. The commit-loss case
executes a real COMMIT then suppresses acknowledgement through a fixture wrapper;
it proves durable deduplication, not a real network-loss reproduction.

The live administrator browser smoke passed desktop/mobile schema refresh,
no-store, 164 current anchors, explicit-only request, retained focus and no
overflow. Screenshots were inspected. No new UI/assistive-technology acceptance
is claimed. The existing Linux data-bind publication/directory-sync probe passed.

## Evidence and limitations

Frozen source: 3,705 files, SHA-256
`133d57f42ac769abeceb05ebcc915cfff02bb56c22f99868478af81adff18c9b`.
Seven changed code/test files were captured before final qualification; the four
production files exactly match the packaged image. Only documentation followed.
Private logs, source/package inventories, cleanup receipts and screenshots are
retained under `.tmp/session-replay-2026-10-27/` and excluded from Git.
The final capture and packaged qualification are in its `final/` directory;
the final stable fast gate is `fast-final/`. Earlier captures/builds precede
the metadata hardening and are not the final qualified candidate.

The first native preflight exposed a fixture SQL parameter shared between UUID
and text expressions; adding an explicit text cast fixed that observation query.
The successful expanded native entry ran on the immutable final image. No
production bound or durability assertion was weakened.

The preceding Windows backup `fsync` EPERM finding remains open; this work did not
rerun or claim to repair that unrelated host integration cohort. Unchanged prior
provider/media/migration matrices were not rerun. Source/runtime comparison
confirms unchanged shared utilities, migrations, schema, packages and provider
modules; their historical results remain scoped to their original outcomes.

GitHub MCP reported **no open PRs**, including Dependabot. There was no eligible
PR to select randomly, implement, close or rebase in this step. No PR was merged.

## Recommendation and next item

Keep ordinary bounded pool admission, this short transaction with required audit,
independent deadline, actual retirement and conservative commit uncertainty.
Benefits are atomic evidence and bounded waits; costs are extra round trips and
intentional temporary refusal during contention. See the full alternatives and
official links in [research](SESSION_REPLAY_RESEARCH_2026_10.md).

**Next: transactional rotation/issuance with compatible family ownership.** Existing
rotation still separately revokes its parent, inserts a child and links the parent.
This step does not prevent a concurrently authorized late child insert after a
replay transaction's snapshot. Qualify both orderings, parent CAS/current authority,
required rollback, concurrency and uncertain commit before claiming family fencing.

See [design](SESSION_REPLAY_DESIGN.md),
[Docker design](LOCAL_DOCKER_SESSION_REPLAY_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_SESSION_REPLAY_OUTCOME.md).
