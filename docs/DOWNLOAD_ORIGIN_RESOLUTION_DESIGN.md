# Guarded download origin resolution design

Accepted October 9, 2026, America/New_York. Baseline clean main:
`e08e6587ac157aecb41bf479fe8455db038ff344`; Node 24.18.1, npm 12.0.2.
No branch, release, tag, provider upgrade or PR merge belongs to this change.
Executed results belong in the separate [outcome](DOWNLOAD_ORIGIN_RESOLUTION_OUTCOME.md).

## Problem and authoritative boundary

An older execution R1 can retain an exact caller-owned batch after a lost POST
response while a newer allocated R2 wins the latest-origin query. R1's valid
evidence cannot advance its candidate; R2 cannot safely send another request.
Existing administrator links reach R1, but adoption correctly refuses a newer
origin. This requires a distinct explicit resolution command, not relaxation of
every downstream origin check or conversion to operator adoption.

R1 must be a terminal unresolved source-owned version 2 batch attempt, with a
complete immutable manifest and unchanged current physical source. A fresh
authenticated supported-version binding must match its saved binding. Exact
whole-manifest remote-queued, InProgress or Completed/Succeeded batch evidence
must pass the existing pure provider policy. Definitive rejection, legacy
unknown dispatch, partial/local-only/malformed/restarted evidence refuse.
There is no provider enqueue, cancellation, removal or invented replay key.

## Fresh official research and alternatives

The separate [October primary-source ledger](ORIGIN_RESOLUTION_RESEARCH_2026_10.md)
records fresh MCP discovery/opening of OWASP authorization, transaction
authorization and business logic; IETF RFC 9110; PostgreSQL 18 locking and
application consistency; W3C WCAG 2.2, status messages and H102; and WHATWG
native dialog. It distinguishes normative specifications from informative
guidance, and consultation dates from publication. Apply current significant
reviewed data, server authority after awaited reads, short transaction locks,
truthful status and native focus semantics at their actual owners.

| Choice | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Keep all origin conflicts unresolved | Preserves uncertainty | Leaves valid older downloads blocked | Retain for cases outside the narrow proof below |
| Automatically ignore a newer cancelled/empty run | Simple recovery | Cancellation or absent history does not prove no provider dispatch | Reject |
| Explicitly retire one proved unused allocation and confirm R1 atomically | Restores existing verified work without another POST | Requires coordinated allocation, worker, retry, readers and retention | Implement |
| Add an immutable resolution table | Strong independent lineage constraints | Additional migration/schema lifecycle; still requires all runtime fences | Defer while paired typed existing records can safely own the invariant |
| Persist paired typed private records in existing run/item JSON | Reuses current command/checkpoint ownership without a migration | Every writer and reader must preserve or validate the reciprocal pair | Implement with explicit writer/retention protection |

## Narrow proof of the unused newer job

The final recommendation stack is native Vue controls and bounded server DTOs;
thin authenticated Express routes; narrow ESM authority, episode policy and
resolution services; PostgreSQL candidate/run/item/lease ownership with durable
commands and required audits; and the existing version-bound slskd batch reader.
Apply WCAG/WHATWG to keyboard/focus/status, RFC 9110 to read/mutation/replay,
OWASP to current transaction authority, and PostgreSQL guidance to actual shared
write fences. No new queue, framework, provider protocol or isolation migration
is required for this bounded slice.

Only one newer R2 may intervene. It must explicitly address the same single
candidate with requestedCandidateCount=1 and a manual or missing_music_manual
trigger; no sibling item, transfer link, recovery reservation or external/private
approval job may be retired. Running/currently claimed/live leased work refuses.

Two local proofs are eligible: pending attempt_count=0 with null claimed fields,
no lease history at all and no handoff/provider evidence; or a valid explicit
not_dispatched checkpoint with empty receipts/failures/enqueued data, no accepted
provider observation and no active lease/claim. Allocation sets started_at, so
that timestamp is not a never-started test. Previously run legacy work without
a checkpoint, absence at the provider, cancellation alone and unknown/malformed
fields never establish non-dispatch.

## Durable ownership and concurrency

A narrow origin store owns current-origin SQL, review/locked context and
conditional retirement. R2.summary.downloadOriginSupersession and
R1.execution.handoff.originResolution store the same typed version 1 record:
resolutionId, importCandidateId, sourceRunId, newerRunId, sourceAttemptId,
requestHash, actorUserId, resolvedAt and bounded publicOutcome. R2 becomes
permanently cancelled. Current-origin readers skip it only when the cancelled
record matches the actual R1 item/attempt and reciprocal record. Malformed or
orphan records remain authoritative and fail closed.

The command reuses durable idempotency and a saved outcome for response or
command-record completion loss. A different intent cannot replace the first
resolution. Actor/current session, participant consent/floors/formats, physical
source, maintenance and exact reviewed digest are rechecked inside the owning
transaction. Extract the existing adoption authority policy into a small shared
service; preserve its existing behavior and error contracts.

Provider I/O occurs outside locks. Lock order is maintenance, current accounts,
wanted/discovery owners, candidate/files, run rows by ID, item rows by run ID,
then leases by key. Fresh claim/lease facts are reread under the locks. Scoped
allocation and item association participate in the candidate parent fence, so
an R3 origin cannot be inserted between the final comparison and confirmation.
Retirement, paired records, exact receipt links, candidate phase, existing required
handoff audits and one operator resolution audit commit together. The common
confirm service accepts a caller-owned transaction and revalidates raw proof.
Any failure rolls back the entire decision, including cancellation.

Lifecycle/start/retry/claim and ordinary item replacement/updates preserve and
refuse retired work. A stale R2 worker must never overwrite its marker or enqueue.
Both lineage rows survive per-type/global retention. Shared effective-origin
reads cover confirmation, recovery, adoption and wanted progress. Bounded private
polling keeps resolved R1 downloading/completion visible even though global latest
R2 is cancelled or unrelated work exists. Public API projections omit both private
records, actor/hash and attempt/provider evidence.

## HTTP and administrator interaction

Under the existing exact execution-run/candidate prefix, add GET
download-origin-review and POST download-origin-resolution. GET has no mutation;
POST requires fresh administrator/session/CSRF and the existing durable
Idempotency-Key command contract. Its body contains only reviewDigest; the server
owns both jobs, manifests, source, policy and provider evidence. A digest is
freshness, not authorization. Bound provider errors and rate-limit both routes.

Review returns downloadOriginReview with operationRunId, importCandidateId,
canRestore, reasonCode, reviewDigest, verifiedFileCount and retiredRequestCount.
The result is downloadOriginResolution with outcome=restored, the same bounded
context/counts and replayed. No provider IDs, paths, peers or raw bodies leave it.

Reuse the existing adoption refusal's review handoff. Close its dialog before
opening a small sibling native confirmation, Cancel first, with a separate narrow
composable/presenter. Explain that it stops the unused newer request and tracks
verified existing downloads. Confirm only server canRestore. Preserve the same
digest/key after uncertain responses, expose pending feedback outside the closed
modal, honor moved/SPA focus and shared panel command exclusion. Refresh both
execution and queue/selected summaries after success. Existing canonical links
and bounded older references remain the entry path.

## Verification and next decision

Use meaningful pure policy/service/HTTP tests and real PostgreSQL for reciprocal
ownership, claim/lease/allocation races, stale worker writes, replay, foreign links,
fresh authority/policy/source, required audit rollback and both retention paths.
Exercise actual worker and heartbeat/module wiring with controlled provider reads.
R1's full lost-response batch must advance once; a concurrent unused R2 sends zero
additional POSTs. Dispatched/uncertain/live R2 refuses. Browser checks cover native
Cancel/Escape, review gating, same-key retry, exposed pending, focus, navigation and
both summary refreshes. Run complete repository validation and fresh audit before
commit/push on main. No live provider restart, storage-reset exactly-once or
assistive-technology speech claim follows from these controlled tests.

The next recommendation will follow executed evidence; broader multiple-newer,
reserved/recovery and incomplete legacy resolution remain outside this contract.
