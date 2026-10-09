# Guarded abandoned preparation closure design

Accepted October 9, 2026, America/New_York. Clean main baseline
`f5525d4b53a009ffb42109cfe2c8b6cef52ae47c`. No branch, release, tag or PR merge.
Executed results belong in the separate [outcome](ABANDONED_PREPARATION_OUTCOME.md).

## Problem and decision

A future preparation epoch may remain preparing after its worker disappears.
Existing refusal and final-send owners deliberately deny another lease's epoch.
Missing provider rows or an expired lease alone cannot establish non-dispatch.
The versioned protocol's exact preparing state can establish it only when every
producer honors a fresh, committed fence.

Fresh [official research](ABANDONED_PREPARATION_RESEARCH_2026_10.md) covers
PostgreSQL locks/current time, OWASP authorization/workflow, HTTP retry semantics
and applicable W3C/WHATWG feedback. Normative requirements, informative guidance
and this application-specific protocol are separate.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Certify from timeout or Cancel status | Small implementation | Does not prove which external effect occurred | Reject |
| Close only in a replacement worker | Reuses worker lease | Misses terminal cancelled/failed jobs | Reject as sole owner |
| Add a new operator command and screen | Explicit interaction | Duplicates existing cancellation and restoration flows | Defer |
| Close exact idle future preparation during existing reconciliation | Covers terminal and unclaimed retry work; reuses bounded polling | Requires a fresh lease, reciprocal immutable fences and atomic audit | Implement |

Final stack: existing bounded confirmation reconciliation; narrow ESM closure
policy/service/store; existing candidate/files/run/item/lease locks; a distinct
short closure lease; required audit and private reciprocal cancellation fence;
existing administrator origin restoration. No new framework, table or queue.

## Owning protocol

Close only one exact typed future preparing epoch on an idle single-candidate
manual download run. Reserved recovery and external-request work retain their
existing owners. The candidate/run/item/source/manifest and any correlated staged
receipt-free attempt must agree. Require the run's selected candidate, count and
single item; no claim, live lease, transfer links, provider evidence, adoption,
origin retirement or prior closure. Running work waits for existing stranded-run
recovery; pending unclaimed, failed, completed and cancelled work can be checked.
Historical absence, malformed records and may_have_dispatched remain unresolved.

The caller supplies the complete observed epoch; the owner rechecks it under
candidate/files, run, item and lease locks. The store acquires a distinct closure
lease only if the current row is absent, released or expired. Same-owner live
reacquisition is forbidden. Refresh database clock time after lock waits;
transaction-start NOW is insufficient for the final expiry decision.

Retain the original epoch identity, captured lease, source and manifest. Seal its
refusal as preparation_abandoned or operation_cancelled, recording the fresh
closure lease and observed cancellation fields separately. An epoch closure and
the run's private downloadPreparationClosure contain the same typed provenance.
Save the blocked item and cancelled parent, required closure audit and released
closure lease in one transaction. Failure rolls back every part. No provider I/O,
transfer cancellation, automatic restoration or immediate rearm occurs.

Presence of the parent closure fence, even malformed, blocks ordinary run start,
retry, queue claim and item writers. Lifecycle normalizers cannot erase it.
The public projection hides private records and exposes only a safe closed flag
where existing retry controls need it. Existing guarded origin restoration can
consume only the reciprocal valid refusal, and retains fresh administrator,
session, CSRF, source, recipient/quality, whole-batch and reviewed-digest checks.

An old native beforeSend callback compares the same epoch and captured lease.
After closure it cannot cross or POST. Crossing-first makes closure ineligible;
closure-first makes dispatch ineligible. A provider error, lost response, 409 or
crash after crossing never becomes negative proof. Generic Cancel is an intent,
not proof that a provider transfer was cancelled.

## Verification and limits

Use real PostgreSQL with controlled native HTTP to hold an old callback, close
its epoch, then release it and assert zero POSTs. Cover staged/unstaged epochs,
crossing races, audit rollback, live/missing/released/expired leases, claims,
cancelled stranded work, stale snapshots, retry/claim/start fences, reciprocal
privacy, current source, and restoration of the older complete batch. Run focused
consumer checks, complete repository validation and fresh dependency audit.

No UI interaction changes are planned. Existing keyboard/focus/status behavior
continues to apply; DTO tests do not establish assistive-technology speech or
whole-platform conformance. Controlled provider tests do not establish external
exactly-once or live Soulseek behavior. Generic worker lease renewal/release
generation fencing is a distinct follow-up unless a closure regression requires it.
