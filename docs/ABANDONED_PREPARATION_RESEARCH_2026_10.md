# Abandoned preparation research

Read-only primary-source research, 9 October 2026 local and UTC. Root reports
clean main f5525d4b53a009ffb42109cfe2c8b6cef52ae47c. This assessment reads the
prior [design](PRE_PROVIDER_REFUSAL_DESIGN.md) and
[outcome](PRE_PROVIDER_REFUSAL_OUTCOME.md); it does not independently exercise
the shipped runtime.

The prior outcome deliberately leaves a preparing epoch from another lease
blocked. The proposed slice should close only an exact future-protocol epoch
that remains before the irreversible dispatch boundary. Expiry, cancellation,
an absent checkpoint or missing provider history cannot alone establish that
state.

## Fresh primary evidence

GitHub/MCP web discovery was recorded at 20:10:09 UTC. Official direct reads,
version navigation and targeted excerpts continued through 20:13:19. Returned
URLs, requests and responses are retained below. No search-engine publication
label is treated as the publisher's version or publication date.

| Source | Authority/version | Bounded implication |
| --- | --- | --- |
| [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Versioned official documentation; canonical URL reached through official navigation | Row locks protect returned rows until transaction end. Contending owners wait and obtain the updated row; every producer must acquire related objects consistently. |
| [PostgreSQL 18 consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) and [isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | Versioned official documentation | Appropriate blocking locks and snapshot timing govern current validity. Separate Read Committed checks do not automatically establish a coherent cross-row decision. |
| [PostgreSQL 18 time functions](https://www.postgresql.org/docs/18/functions-datetime.html) | Versioned official documentation | now()/transaction_timestamp() represent transaction start; clock_timestamp() advances during statements. Use refreshed time for a final expiry decision after waits. |
| [OWASP workflow guidance](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Informative, mutable guidance | Persist valid transitions, use conditional writes with checked row counts, and apply the same business rules at sensitive entry points. Local transactions cannot roll back provider acceptance. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative guidance | Validate current object authority on every request. A private certificate, expired lease or reviewed digest grants no caller permission. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), sections 9.2.1–9.2.2 | Normative HTTP semantics | Read-only method semantics do not prove that earlier non-idempotent work was never applied. Retry requires a defined safe contract or evidence of non-application. |
| [WCAG 2.2](https://www.w3.org/TR/2024/REC-WCAG22-20241212/) and [status explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Normative Recommendation 12 December 2024; informative explanation updated 11 May 2026 | Expose stopped versus uncertain progress programmatically without forcing focus. A cancellation request must not be presented as completed provider cancellation. |
| [WHATWG dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html) | Normative living HTML standard | Existing explicit confirmations retain native cancellation/close and intentional focus behavior. This automatic ownership closure does not itself justify adding a modal. |

Local read-only version commands observed Node 24.18.1 and npm 12.0.2 at
20:10:32 UTC, matching the prior outcome. PostgreSQL 18 is the consulted
documentation version; no running database version was probed. Provider versions
and contracts are explicitly inherited from the
[batch ledger](SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md) and
[legacy ledger](SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md).
They were not re-queried and no upgrade or future compatibility is claimed.

## Recommended owning contract

These are application-specific inferences, not a standardized lease algorithm
or verified implementation.

Close only a well-formed stamped epoch whose exact run/item/source/manifest,
generation and captured lease remain current and whose phase is preparing.
Use the same candidate/files, run, item and lease locks as final dispatch,
with existing earlier authority/maintenance locks where required. A fresh
replacement lease or owning cancellation fence must exclude the old captured
lease identity, including owner and acquisition time. Merely noticing expiry
outside the transaction does not fence a delayed callback.

Re-read cancellation, current origin/ownership and exact epoch after lock waits.
Use an authoritative refreshed time consistent with lease handling; do not use
an old transaction-start instant as a final wall-clock expiry gate. The old
callback must repeat its lease/epoch/phase predicate at the final send boundary.
A zero-row closure CAS is a refusal, not permission to continue.

Persist closure, the explicit old/new ownership relationship, bounded reason
and required audit together. Preserve captured history rather than relabelling
the old lease as the new one. If staged attempts are eligible, require the exact
correlated receipt-free attempt and preserve it; never clear an unrelated attempt,
invent receipts or treat absence as a substitute for typed epoch evidence.

Closure-first must prevent the old callback from crossing or invoking POST.
Dispatch-first must leave may_have_dispatched and original uncertainty intact.
Cancellation is a local intent/fence; it does not undo provider acceptance.
A commit acknowledgement loss must be resolved from durable state, not a new
POST or a fabricated certificate. Preserve historical unmarked, malformed,
crossed, partial and adopted episodes on their existing conservative paths.

Separate closing an old epoch from authorizing a new generation. Retry must
invalidate old closure eligibility atomically and still satisfy current
authority/source/policy/provider/lease checks. Cancellation must not silently
reopen work; newer explicit intent must retain its normal ownership.

## Tradeoffs and minimum proof

A global timeout-to-unused rule is small but erases causality. Continuing to
block all abandoned work preserves uncertainty but leaves known future
preparation failures unusable. An exact guarded closure with shared dispatch
fencing is the bounded option to evaluate; it costs producer coordination and
concurrency evidence. This does not create external exactly-once execution.

Prove closure versus delayed version/preparation return with zero POST, both
closure/dispatch winner orders, a live original lease refusal, fresh lease
reclaim and old callback identity, cancellation before/after lock waits, newer
allocation during closure, audit rollback, commit-response loss, staged attempt
correlation, unchanged crossed uncertainty, stale writes/retention and private
projection. The zero-POST guarantee concerns an expired/replaced callback that
has not crossed. Lease expiry after an authorized irreversible boundary remains
possible dispatch rather than retrospective non-dispatch proof.

Real PostgreSQL owns local lock/CAS/rollback claims; native controlled HTTP owns
tested callback ordering and POST counts. Focus/status checks apply to the
existing visible journey only. None establishes live provider behavior, actual
assistive-technology speech or whole-platform conformance.

## Retained evidence and scope

Raw discovery, official reads, prior-document reads and installed-version outputs:
.tmp/abandoned-preparation-2026-10/official-source-discovery-and-reads.json,
SHA-256 1d072c6d958688c3c82fe18992696d71e0896846034ff55c1647609958f49965.

No application source/test edit, runtime test, PostgreSQL operation, Git mutation,
provider mutation, external message, branch, release or merge occurred in this
research. PR evidence is separate:
[design](OPEN_PR_APPLICABILITY_ABANDONED_PREPARATION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_ABANDONED_PREPARATION_2026_10_OUTCOME.md).
