# Explicit pre-provider refusal design

Accepted October 9, 2026, America/New_York. Clean main baseline
`12b9c1104c1dd6a129f625fc1ef8316cfd2395e6`; Node 24.18.1/npm 12.0.2.
No branch, release, tag, provider upgrade or PR merge is part of this change.
Executed results belong in the separate [outcome](PRE_PROVIDER_REFUSAL_OUTCOME.md).

## Purpose and official practice

Version, planning and preparation refusals can occur before the worker creates
a provider attempt. A previously leased job then has no durable unused proof,
so the existing administrator resolution correctly refuses it. Future jobs need
an explicit local protocol; historical absence must remain unknown.

Fresh MCP discovery/opening in the separate
[research ledger](PRE_PROVIDER_REFUSAL_RESEARCH_2026_10.md) covers OWASP current
authorization/transaction/business logic, RFC 9110 retry semantics, PostgreSQL 18
locking/consistency and applicable WCAG/WHATWG status/dialog behavior. Normative
requirements, informative guidance and application inference remain distinct.
Existing provider release ledgers are inherited, not a new compatibility claim.

| Approach | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Infer non-dispatch from a missing checkpoint, error or timeout | Small change | Cannot establish which side effect occurred | Reject |
| Add an exact preparation epoch and conditional refusal | Durable negative proof for future jobs | Every dispatch and writer must honor the epoch | Implement |
| Treat every post-boundary local error as unused | Appears convenient | Commit acknowledgement/network uncertainty can hide a POST | Reject |
| Retain uncertainty after the irreversible boundary | Prevents unsafe duplicate dispatch | Some zero-POST failures remain conservatively unresolved | Implement |

Final stack: existing Vue administrator confirmation; narrow ESM epoch policy,
service and store; PostgreSQL parent/run/item/lease fences and required audits;
existing pinned provider dispatch with a trusted final callback; existing guarded
origin-resolution command. No new queue, framework, table or provider protocol.

## Future-only private protocol

Execution run creation stamps private summary.downloadPreparationProtocol
version 1 only for new download work. Lifecycle updates preserve it. Old runs
without the marker use existing confirmation/dispatch behavior and never acquire
certificates retroactively. Existing uncertain, partial, accepted or adopted
attempts stay on their prior ownership paths before epoch creation.

The per-item private execution.handoff.preProviderEpoch contains version,
epochId, operationRunId, importCandidateId, generation, lease key/owner/acquiredAt,
captured source, requested manifest and preparation time. It starts preparing.
Planning/no-files, scoped preparation and version/config reads happen afterward.
The local manifest may be empty for a real no-files refusal; no provider attempt
or provider receipt is fabricated.

Only two forward transitions exist: preparing to refused, or preparing to
may_have_dispatched. Refusal stores a bounded reason/time with a required audit.
Crossing stores the exact staged attempt and boundary time with a required audit.
Current lease, epoch and phase are compared under ordered locks. After crossing,
no local error, lost response, 409, crash or timeout can certify this epoch.
The owning confirmation path retains all original uncertainty.

Same-lease replay cannot reset a refused epoch. A fresh retry lease may create a
new generation only after an explicitly refused predecessor, invalidating its
certificate before any preparation. A preparing predecessor from another lease
or a crossed predecessor remains blocked; it is not inferred unused. Late old
callbacks cannot cross or refuse the new generation. Successful origin retirement
continues to fence all retries through the existing reciprocal records.

## Actual dispatch boundary and persistence

The provider's pinned enqueue adapter already performs a final awaited local
configuration check. Invoke a trusted beforeSend callback after that check and
immediately before the native client POST. The callback repeats current worker
interruption/authority/lease guards and commits the epoch crossing. Local config
assertions inside the transaction use its client. No provider network I/O occurs
under locks. A fallback adapter without this hook crosses conservatively before
calling its enqueue function; any later failure stays unknown.

The common handoff owner stages its own attempt and correlates it to the preparing
epoch atomically. Refusal may stop only that exact staged, receipt-free attempt
while the epoch still proves the boundary was not crossed. It cannot rewrite an
older unknown attempt. Epoch state/content, not UUID alone, participates in all
ordinary snapshot comparisons. Initializers, replacement, lifecycle/retry,
resolution and both retention paths preserve/fence the record; a stale preparing
snapshot cannot erase a refusal or crossing.

Lock order is candidate/files, run, item, lease, with existing maintenance and
authority gates where needed. Seal/cross plus required audit commit together;
audit failure produces no certificate or permission to POST. A lost commit
acknowledgement is read through durable state and stays conservative.

## Existing administrator flow and evidence

The origin evaluator accepts only a valid current refused epoch for the exact
newer job, no current claim/live lease, no transfer links/provider evidence and
the existing single-candidate/manual scope. Older whole-batch proof, current
administrator/session/CSRF, consent/quality, source and reviewed digest remain
mandatory. Certificate presence never grants client authority or starts a
command automatically. Private epoch/protocol data is omitted from all public
projections. Existing native confirmation, same-key retry, focus/status and dual
refresh behavior are sufficient; add only meaningful validation for this path.

Prove actual leased R2 refusal followed by guarded R1 restoration with zero extra
POSTs. Exercise unsupported versions, planning/no-files, paused preparation,
seal/cross races, new lease retries, late callbacks, required-audit rollback,
ordinary stale writes/replacement, retention and original lost/partial/409 resume.
Use real PostgreSQL and native controlled HTTP for ownership/boundary claims,
focused policies/services and existing browser controls for interface evidence.
Run full repository validation and fresh audit before committing/pushing main.
Controlled tests do not establish live provider exactly-once or AT speech.
