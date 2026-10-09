# Provider batch handoff and explicit download adoption design

Accepted design, 8 October 2026 local / 9 October UTC. Baseline main:
`ac4993f34755bd444bf0e9d61d20eea1c41fdeca`; Node 24.18.1, npm 12.0.2.
The checked-in slskd deployment stays at 0.25.1. No release, provider upgrade,
branch or PR merge belongs to this change. Executed results belong in the separate
[outcome](BATCH_DOWNLOAD_HANDOFF_OUTCOME.md).

## Purpose and official contract

The prior [receipt confirmation change](DOWNLOAD_HANDOFF_CONFIRMATION_DESIGN.md)
refuses history-based acceptance. This slice adds caller-owned batch evidence for
the source-verified slskd 0.26.0 API, exact receipt detail reads, and an explicit
administrator resolution contract for eligible legacy uncertainty.

Fresh MCP research discovered and opened official release/source URLs. The
[provider research ledger](SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md) records immutable
0.25.1/0.26.0 versions, complete wire schemas and source-derived limitations.
The batch API creates its caller-UUID record before processing files. GET returns
owned transfer rows but no durable original manifest, failure list or enqueue-
finished marker. A locally queued row can precede task scheduling. Provider
restart can create new IDs without BatchId. Batch existence, 409, timestamps,
empty/subset rows and local-only queue state cannot establish full admission.

## Applicable standards, freshly consulted

| Source/status | Application |
| --- | --- |
| [RFC 9110 section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html), normative HTTP semantics | Never retry an uncertain non-idempotent POST with a new key or fall back to another transport. Provider behavior supplies any replay contract. |
| [IETF Idempotency-Key document status](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/), expired Internet-Draft as consulted | Do not present this draft as an RFC or assume an arbitrary header is supported. slskd's verified key is its request-body batch UUID. |
| [OWASP business logic](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) and [transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), informative guidance | Reauthorize current objects/actors, bind significant reviewed data to the command, and commit ownership, links and required audit together. A digest is a freshness check, not permission. |
| [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html), vendor documentation | Reuse parent/candidate/item lock order, checkpoint comparison and durable command ownership; provider I/O stays outside transactions. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation; [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) and [H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102), informative guidance | Distinguish linked/queued work from completion, keep pending feedback exposed, and test keyboard/focus and refresh behavior. |
| [WHATWG dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html), living HTML specification | Use native modal focus/inert/Cancel behavior for the administrator's explicit adoption decision. Browser DOM checks do not establish screen-reader conformance. |

These sources do not require a new queue, isolation-level migration, framework,
MFA product or idempotency-header protocol. Consultation date is not publication.

## Alternatives and tradeoffs

| Choice | Benefits | Costs/limits | Decision |
| --- | --- | --- | --- |
| Keep direct receipts only | Compatible and conservative | Cannot resolve a lost response automatically | Preserve for supported legacy deployments |
| Enable batches from an unchecked version range or mutable client | Easy integration | Future API/schema changes and endpoint switches can invalidate assumptions | Reject |
| Pin a verified transport/endpoint and recover from full progressed batch records | Caller-owned evidence without blind retry | Local-only, absent, failed or ambiguous records still need review | Implement |
| Confirm from batch existence/count alone | Fast | Records can precede admission or survive restart errors | Reject |
| Let an operator clear uncertainty or resend | Simple-looking escape hatch | Cannot prove the original POST never ran | Reject |
| Explicitly adopt a verified whole set of existing downloads | Gives an eligible administrator a useful resolution without provider mutation | A new operator decision, not proof of the original POST; incomplete/stale/conflicting episodes stay unresolved | Implement with separate provenance |

## Final recommendation stack

1. Narrow ESM protocol, batch-envelope/evidence and provider-binding policies.
   Probe the authenticated version endpoint before checkpoint preparation. Enable
   batches only for the inspected 0.26.0 stable contract; retain the verified
   0.25.1 legacy route. Unknown/future/prerelease versions refuse before POST.
   Do not silently infer support from BatchId fields or Swagger availability.
2. Pin one normalized provider client/configuration for selection and dispatch.
   Persist a private endpoint/mode fingerprint, transport/version and the same
   local attempt UUID used as batch ID. Keep credentials out of fingerprints and
   API projections; compare credential/config changes in memory before POST.
   Saved uncertain attempts never switch protocol, endpoint or UUID.
3. Validate direct batch POST `{batch, failures}` against exact batch ID, peer,
   Download direction, unique GUID/BatchId and immutable positive-size manifest.
   Extra/duplicate/foreign/malformed rows refuse. Partial/failure distinctions
   remain explicit. For lost-response GET, require every file to have actual
   remote-queued, InProgress or Completed/Succeeded evidence without adverse
   exception/conflicting flags. Local-only/requested/error/unknown rows remain
   in review. No admission inference from dates or absence.
4. Fetch known receipt details by ID with bounded deduplicated concurrency,
   validate returned body identity and BatchId, and retain uncertainty on missing
   or unavailable data. This covers removed completed rows without filename
   discovery. Source-verified startup/shutdown markers must not trigger an
   automatic failure cascade onto unassociated restarted work.
5. Feed verified evidence to the existing owning transaction; recheck attempt,
   physical source, current origin and scoped authority. Keep receipt/checkpoint/
   phase/required audit atomic. Preserve stale-origin evidence in review without
   relaxing every downstream ownership rule. Reuse existing leases, interruption
   gates and heartbeat; no provider I/O under row locks.
6. Add administrator-only review and adoption endpoints. The read resolves the
   exact run/item, saved manifest/source and current policy, then returns bounded
   meaningful file/state choices and a review digest. POST accepts only digest
   and unique transfer GUIDs, refetches current evidence and rechecks fresh admin,
   session/CSRF, maintenance, current scope/quality, physical source and latest
   eligible origin. Use the existing durable idempotency service plus a saved
   adoption outcome to prevent duplicate links, phases or audits on replay.
7. Adoption is explicit reuse: persist operator provenance and the original
   uncertain dispatch separately. Never fabricate a direct POST receipt or
   `not_dispatched`. No provider POST/cancel/remove occurs. Existing positive
   transfers must cover the full immutable manifest; another episode's link,
   conflicting source, missing immutable evidence or newer owning origin refuses.
   Adopted-episode failure/missing/restart uncertainty remains review-only; it
   cannot authorize automatic download recovery from the original unknown POST.
   Normal library quality/file/recipient guards remain in force.
8. Add a small native-confirmation component/composable to administrator match
   diagnostics, with bounded references to older unresolved items and exact
   review links from eligible canonical decisions. Keep provider bodies, peers,
   paths and new private evidence out of requester projections. Cancel/Escape
   issues no command; uncertain retries retain the same intent and review data.
   Current status reflects the durable result without focus theft.

The new private JSON contract can use existing execution checkpoints and command
records; no schema migration is planned unless inspection shows a required durable
constraint cannot be represented safely. Do not rewrite existing historical
receipt ownership or import arbitrary remote batches.

## Evidence and limits

Test version selection, pinned configuration drift, direct envelopes, 409/lost
responses, complete positive vs local-only/subset/extra/error batches, shutdown
markers and exact removed receipt reads. Use real PostgreSQL for comparison,
foreign-link/audit rollback, concurrency, replay and fresh authorization/policy.
Exercise actual worker/heartbeat/module wiring with a controlled HTTP provider,
and browser keyboard/Cancel/pending/focus/refresh with production-derived facts.
Run complete repository validation and a fresh security audit before commit.

No claim covers universal provider exactly-once behavior, storage-reset uniqueness,
all future versions, blind replacement-ID correlation or every historical episode.
Unverifiable legacy episodes remain in review; their absence cannot authorize
another POST. The next item will follow actual implementation/research findings.
