# Minimal failed-candidate facts for restart qualification

October 24, 2026. Narrow the remaining failed-candidate detail and child-lock
cost in the bounded restart protocol, without changing its authority.

The subsequent [read-scope design](QUALITY_REVIEW_READ_SCOPE_DESIGN.md) extends
these facts to read-only chooser/detail reads. The original table below records
the qualification increment; selected commands retain their full scope and locks.

## Contract and architecture

Qualification needs the failed candidate's id, status, source search and saved
quality/recipient context. It does not evaluate the failed candidate's files,
file decisions, raw provider payload, peer/path, scores or event detail. Current
review publication still comes from the existing owned-release facts query.

The qualification-owned release projection reuses the canonical review/conflict
SQL fragments and mapper, but omits unrelated prepared-add facts and their file
count subquery. It returns only owned identity, metadata release, disabled state
and current review facts. Selection retains the original owned-release query.

Add a dedicated SQL store returning only identity/status/search and these saved
context keys: wantedReleaseId(s), profileCode, minimumBitrateKbps, qualityOverride,
operatorTrackScopes, operatorTrackParticipants and sharedOperatorDiscovery.
Preserve musicQueue versus legacy musicQueueContext precedence, missing keys,
explicit JSON null, scalar/array values and malformed track-scope markers. Inside
the old fallback override retain mode, target and numeric floor; inside request
ownership retain sourceMediaRequestId and sourceRequestedForUserId. Those values
support the current floor/consent/track verification; they grant no new consent.

Use explicit known-key projection in SQL before values reach Node. A materialized
one-row CTE extracts the three relevant subtrees once for the outer projection.
It avoids expanding unrelated object keys, but PostgreSQL can still decompress
the stored JSONB value. Required track/recipient arrays can still be large. This
is a returned-fact and child-access reduction, not a byte, physical-I/O or RSS cap.

Extract the shared scope reader and current-scope guard into small ESM factories.
Both full selection and narrow qualification use the same policy construction,
lock order, Read Committed semantics and fresh actor/participant checks. The
qualification entry point injects the narrow reader and parent-only lock. The
selection entry point keeps its existing full candidate/file/decision behavior.
Qualification cannot accept a selected-candidate argument.

| Boundary | Reader | Failed-candidate locks |
| --- | --- | --- |
| Restart request / worker | Minimal owned review and explicit policy facts | Parent FOR UPDATE |
| Replacement selection | Existing full owned-release and candidate detail | Existing parent, files and decisions |
| Read-only chooser/detail | Existing full scope | No mutation locks |

## Lock boundary

Retain FOR UPDATE on the failed parent row, with no explicit file or decision
row reads/locks. Removing those child locks is safe only because their values
are absent from qualification policy inputs. Keep the parent lock mode: changing
to NO KEY UPDATE would also permit foreign-key KEY SHARE inserts, including new
review evidence. This increment does not broaden that publication behavior.

Maintenance, accounts, wanted/discovery rows and apply-admission ordering remain.
After waiting for the parent, reread minimal facts and current scope before any
window or intent. The final NOWAIT revision fence remains after all candidate
reads/locks. Intent/audit/owned completion, cancellation, TTL and exact lease
ownership retain the existing transaction. No new route, public state, migration,
schema object, background service or separate application is needed.

## Qualification

Compare actual SQL projection with full candidate policy outcomes across strict,
numeric, shared, fallback, revoked/foreign consent, legacy and malformed contexts,
plus valid/stale track catalogs and ownership-sensitive track unions. Preserve
presence-based refusal and durable progress-context digest parity. Use large
unrelated payloads and many child rows to prove returned facts do not scale with
irrelevant detail; report actual serialized
bytes, not inferred process memory.

In independent PostgreSQL sessions, hold existing file/decision row locks: the
narrow parent lock must succeed while the original lock path waits/refuses.
Verify parent mutation/delete and foreign-key insertion remain serialized, and
the actual guarded reread observes committed policy changes after a parent wait.
Run the same store/lock parity fixture on guarded packaged PostgreSQL. Retain
current HTTP/queue, selection, cursor/fence, browser and controlled-media cohorts.
Manual screen-reader/device acceptance remains deferred.
