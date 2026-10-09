# Durable pre-provider refusal research

Read-only primary-source research, consulted 9 October 2026 local and UTC.
Root supplied clean main 12b9c11; no Git command verified that baseline.
The supplied scenario is a future leased worker refusing provider preparation
or version compatibility before enqueue. No current runtime owner was inspected
or exercised for this research.

A future refusal can establish non-dispatch only through the exact owning
protocol. Historical missing checkpoints, absent provider rows, cancelled jobs,
or preparation exceptions do not independently prove that enqueue never occurred.

## Fresh official source ledger

MCP web discovery began at 19:09:23 UTC. Direct discovered-URL reads were
recorded at 19:11:45; detailed reads and official numbered navigation followed
through 19:13:22. Timestamps are tool completion observations, not publication
dates. PostgreSQL navigation supplied canonical version 18 URLs. W3C history
supplied the frozen Recommendation; its Understanding index and H102 supplied
the status and WHATWG dialog pages.

| Primary source | Authority/version established by the read | Relevant guidance |
| --- | --- | --- |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative, mutable guidance | Derive current object authority server-side, deny unproven access, and check every request. A certificate or review digest is not caller authorization. |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) | Informative guidance | Bind significant decision data and retain a final execution authorization gate. Financial examples do not prescribe new MFA here. |
| [OWASP Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Informative guidance | Persist and validate workflow transitions. Conditional updates must check affected rows. A local transaction cannot atomically save an external effect; retry behavior depends on the provider's documented contract. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), sections 9.2.1–9.2.2 | Normative HTTP semantics specification | Safe-method semantics concern requested effects. Automatically repeating non-idempotent work requires a known retry contract or evidence the original request was not applied. An HTTP error alone does not supply that evidence. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Versioned database documentation 18 | Row locks protect returned rows while held. Acquire multiple objects consistently and keep transactions short; cooperate with all affected producers. |
| [PostgreSQL 18 application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) and [isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | Versioned database documentation 18 | Under non-serializable writes, current validity requires appropriate blocking locks. Snapshot timing matters; a check before lock acquisition is not the final current state. |
| [WCAG 2.2 Recommendation](https://www.w3.org/TR/2024/REC-WCAG22-20241212/) | Normative W3C Recommendation, 12 December 2024 | Applicable keyboard/focus requirements and 4.1.3 status messages govern exposed refusal/retry feedback. No whole-platform conformance is asserted. |
| [Understanding status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Informative explanation, updated 11 May 2026 | Programmatically expose waiting/result/error changes without requiring focus movement. Give enough context to understand the changed message. |
| [H102 native modal technique](https://www.w3.org/WAI/WCAG22/Techniques/html/H102) | Optional informative technique, updated 12 January 2026 | For an explicit confirmation, verify keyboard opening, initial focus, confinement and return to the retained invoker. |
| [WHATWG dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html) | Normative living HTML standard | Native modal behavior makes the surrounding document inert. Use intentional initial focus and native cancel/close semantics; keep pending feedback exposed at the chosen modal timing. |

No publication date was inferred for mutable OWASP/WHATWG pages. The selected
WCAG Recommendation and informative update dates were read. Requested database
documentation is 18; the running server version was not probed.

## Recommended bounded protocol

The following is an application-specific inference from these sources, not a
standardized certificate schema or a demonstrated runtime guarantee.

1. Persist a private preparation epoch before awaited provider preparation.
   Bind its immutable run/item/candidate/source identity and exact intended
   manifest to the owning operation. A lease or a run status alone cannot replace
   this frame. Current authority, participants and applicable policy still need
   their normal checks.
2. Separate preparation from permission to dispatch. A version/configuration GET
   is provider I/O but is not the download-enqueue command. The certificate should
   mean no enqueue was invoked for this exact epoch, rather than no provider
   contact occurred.
3. Certify a known pre-enqueue refusal only with a conditional owning write.
   Require the same current epoch and its undispatched state, with no contradictory
   checkpoint/receipt/link/uncertain attempt. Check the CAS result and commit
   the bounded refusal reason, necessary audit and terminal result together.
   A stale worker or replaced lease must not certify another epoch.
4. The final dispatch-boundary owner must use the same epoch/state predicate.
   Once the durable transition permits dispatch, refuse a new non-dispatch
   certificate unless the owning protocol has stronger explicit proof. A crash
   between this transition and POST is conservatively unknown even if no POST
   actually began. Losing the commit acknowledgement is also uncertainty.
5. After enqueue invocation or an uncertain boundary, preserve existing receipts
   and uncertainty. A thrown response, absent transfer, missing checkpoint,
   cancellation or expired lease cannot retroactively convert it into refusal.
   Do not manufacture direct receipts or erase original history.
6. Make preparation, dispatch, resume/retry, lease replacement, cancellation,
   origin resolution, retention and private/public readers honor the same epoch.
   An isolated certificate writer cannot fence a late producer. Keep provider
   network I/O outside short database transactions; use the transaction client
   for any awaited database-backed local configuration read inside them.

The pre-dispatch CAS is a local concurrency boundary, not an external
exactly-once guarantee. It does not freeze configuration, consent or provider
state forever after the check. A newer explicit allocation must retain normal
authority; an older certificate must not hide it. Historical leased rows without
the new evidence remain conservative and unresolved rather than backfilled.

## Tradeoffs and proof needed

| Option | Benefit | Limitation | Assessment |
| --- | --- | --- | --- |
| Continue conservative refusal for every leased preparation failure | Preserves uncertainty | Known future version/preparation refusals can block useful older evidence | Safe historical compatibility |
| Infer non-dispatch from no checkpoint/provider row or a terminal error | Small change | Absence and status cannot establish the ordering or exclude late dispatch | Reject |
| Add a future epoch-owned refusal certificate and shared final boundary | Makes known local refusal usable without inventing provider acceptance | Requires producer cooperation, durability and concurrency evidence | Preferred bounded design to evaluate |
| Wrap provider enqueue in the database transaction | Appears to join the steps | External acceptance still cannot be rolled back; long-held locks add contention | Reject as an atomicity claim |

Minimum targeted proof should exercise a leased preparation/version refusal
with zero enqueue calls and a durable certificate; stale epoch/lease completion
after newer intent; competing certification versus dispatch; refusal-audit
rollback; commit/response loss and crash immediately around the dispatch
boundary; changed source/manifest/authority/configuration; and retention/replay
plus private projection. Historical malformed/absent evidence must remain
ineligible. Real PostgreSQL proves the local CAS/rollback/interleavings;
controlled HTTP proves call ordering and no enqueue on the tested refusal.
Neither proves live provider exactly-once behavior or universal crash recovery.

An automatic refusal does not itself require a new modal. If a later explicit
resolution command uses confirmation, retain current administrator/session/CSRF
checks and durable replay, Cancel/Escape without mutation, owned focus return,
and exposed pending feedback. Status should distinguish known stopped-before-
enqueue work from still-unknown dispatch without promising download or library
completion. Browser DOM/focus evidence does not establish actual assistive-
technology speech.

## Inherited provider evidence and limits

The prior [slskd batch ledger](SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md) and
[legacy transfer ledger](SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md)
are explicitly inherited. Their exact 0.25.1 compatibility and 0.26.0 inspected
contracts, retention/restart limitations and capability boundaries are not
fresh provider queries this round. No upgrade, future-version compatibility,
new provider absence guarantee or caller-ID exactly-once claim is introduced.

Raw actual discovery/reads are retained under ignored
.tmp/pre-provider-refusal-2026-10/official-source-discovery-and-reads.json,
SHA-256 1eec720c5d9996a34cc0696f96ea5fb80c54b1c2af0c55507d57ae4110c4b48a.
The first broad multi-page open returned some headers without useful body
excerpts; later matching detailed reads/navigation supply the claims above.
The ledger distinguishes authoritative requirements from informative examples
and application-specific recommendations.

No application runtime/source/test edits or inspection, test execution,
PostgreSQL operation, Git command, provider mutation, external message, branch,
release or merge occurred.
Fresh PR eligibility is recorded separately in
[design](OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_OUTCOME.md).
