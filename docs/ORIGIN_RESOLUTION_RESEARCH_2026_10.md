# Guarded origin resolution research

Read-only primary-source research, 9 October 2026 local and UTC.
Root supplied clean main e08e658; no Git command verified that baseline.
The scenario is a newer current-origin allocation R2, known not to have
dispatched, blocking an older R1 with valid batch evidence. R1/R2 are explanatory
labels, not caller authorization or verified live application facts.

## Fresh source discovery

MCP web search discovered official publisher URLs. Pages were opened directly
from those results; PostgreSQL 17 navigation supplied the exact 18 links, and
W3C publication history supplied the selected frozen Recommendation.
Consultation began at 09:05:18 UTC. Matching direct reads began at 09:06:53;
sequential version/navigation and detailed reads followed. Exact query timestamps
and raw returned content are retained in the evidence artifact below.

| Official source | Status/version established by the read | Applicable guidance |
| --- | --- | --- |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative, mutable engineering guidance; no publication date invented | Deny unproven authority and validate permissions for the current request/object. A visible button or digest does not authorize resolution. |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) | Informative guidance | Bind significant reviewed data to the server-owned decision, allow only valid state transitions, and retain a final authorization gate before execution. Its financial authentication examples do not mandate a new MFA product here. |
| [OWASP Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Informative guidance | Enforce workflow state server-side; coordinate check/write races; scope durable retry keys to caller/operation/parameters and authorize replay. A local transaction cannot make external work atomic. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), sections 9.2.1–9.2.2 | Normative HTTP semantics specification | Keep the review read-only. A POST needs a defined durable replay contract or proof that repeating it is safe; uncertain provider acceptance does not authorize a replacement POST. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Versioned database documentation, 18 page reached through official navigation | Returned rows can be locked against conflicting writers. Use consistent object order; keep transactions short. Row locks do not themselves reserve an absent future allocation. |
| [PostgreSQL 18 application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned database documentation | Fresh validity checks need appropriate blocking locks under non-serializable writes. Snapshot timing and cross-row consistency matter; a pre-lock read is not a final authorization snapshot. |
| [WCAG 2.2 Recommendation](https://www.w3.org/TR/2024/REC-WCAG22-20241212/) | Normative W3C Recommendation dated 12 December 2024, reached from official publication history | Relevant keyboard/focus requirements and 4.1.3 status messages apply to the confirmation/update journey. This research makes no whole-platform conformance claim. |
| [Understanding 4.1.3 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Informative explanation, page says updated 11 May 2026 | Announce waiting/result/error changes without moving focus; supply enough context for changed text. Persistent whole-message status can use deliberate atomic semantics. |
| [H102 native modal technique](https://www.w3.org/WAI/WCAG22/Techniques/html/H102) | Optional informative technique, page says updated 12 January 2026 | Test keyboard opening, initial focus, confinement, and return to the invoker when it remains. Technique examples are not the normative standard. |
| [WHATWG dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html) | Normative living HTML standard; consultation is not a publication date | Use native modal/close/cancel semantics and intentional initial focus. Do not remove open manually. Pending feedback must be exposed at the chosen modal timing. |

Documentation 18 was requested; the running PostgreSQL version was not probed.
Latest/frozen WCAG URLs and status/technique update dates were actually read.
OWASP and WHATWG pages have no invented release or publication identity here.

## Concrete tradeoffs for R2 and R1

| Approach | Benefit | Cost or unresolved condition | Recommendation |
| --- | --- | --- | --- |
| Leave every allocation permanently authoritative | Preserves existing origin conservatism | Valid older evidence can remain blocked with no usable resolution | Retain as refusal until guarded proof exists |
| Cancel R2 and simply ignore all cancelled/newer runs | Small code change | Cancellation can occur after dispatch; historical status alone does not establish never-dispatched work or supersession authority | Reject broad rule |
| Delete/rewrite R2 or manufacture an R1 direct receipt | Makes the ledger appear consistent | Erases causality or fabricates acceptance; late writers can recreate conflict | Reject |
| Retry R1/R2 with a new provider POST or key | May produce another visible transfer | Original external work can still exist; adds provider-side uncertainty | Reject for this resolution slice |
| Explicitly resolve one proven non-dispatched R2 toward its exact eligible R1 | Preserves history and gives an administrator a useful bounded action | Requires current proof, atomic receipt/audit ownership, and all affected consumers/writers honoring the resolution | Preferred bounded design to evaluate |

The last recommendation is an inference applying the sources to the supplied
scenario. Standards do not specify Harmoniarr's origin schema or certify its
worker fence. No implementation owner was inspected in this research.

## Minimum owning contract and evidence

R2's non-dispatch proof must come from the durable local protocol and its actual
producers. A missing provider row, no filename match, cancellation, an unexpired
review digest, or a newly absent checkpoint cannot independently supply it.
Require the current eligible pair, immutable R1 source/manifest/attempt and
verified provider evidence; refuse a newer R3, changed physical owner, revoked
consent, stricter floor, active/ambiguous R2, or foreign receipt/batch ownership.

The read should return bounded server-derived context. Confirmation should use
fresh administrator/session/CSRF checks, the existing durable command mechanism,
and a review binding that includes both run identities and significant policy.
Refetch provider evidence outside the database transaction. Recheck current
actor, participants, candidate, checkpoint and allocation facts after locks.
Commit the specific resolution record, any allowed phase/link changes and
required audit together, with a saved outcome for replay after response loss.

Coordinate resolution with allocation creation, worker startup/checkpoint,
confirmation, retry, cancellation and progress consumers at the existing owning
boundary. An isolated lock added only to the new command cannot prove cooperation
by other producers. In particular, late R2 callbacks must not reopen or dispatch
the resolved allocation, and future R3 intent must still win its normal checks.
Locks protect the short local decision; they do not guarantee external exactly-once
execution or policy immutability after work begins.

Use a native confirmation with Cancel/Escape issuing no mutation, exposed pending
feedback, and deliberate return focus. Background refresh preserves a user's
move elsewhere. The result should describe the resolution/tracking state without
promising completed downloads or library addition.

Useful proof is the actual R1/R2/R3 interleaving, not a generic source checklist:
worker-start versus resolution, newer allocation during provider preparation,
role/consent/floor/ownership drift, foreign links, required-audit rollback,
same-intent/expired-command replay, no provider POST, and public/private projection.
Real PostgreSQL owns the transaction/concurrency claims; browser keyboard/focus
and exposed pending DOM evidence owns the interaction claim. Neither establishes
live provider behavior, assistive-technology speech, or universal conformance.

## Provider and evidence limits

The prior [batch research ledger](SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md)
supplies the earlier exact supported-provider contracts and restart/retention
limits. This round did not re-query provider versions or assert new provider
capabilities. The supplied valid R1 evidence still needs the runtime's existing
exact positive-state, ownership and endpoint checks. No absence-to-rejection or
new provider exactly-once claim is introduced.

Raw discovery/reads are in ignored
.tmp/origin-resolution-2026-10/official-source-discovery-and-reads.json, SHA-256
8c4bd7659dbbe93f6b3a597817c76a3001cbae872bc84f2dc6e64bc1b2ed8e1a.
Initial parallel MCP reference opens did not resolve consistently; direct
discovered URLs and fresh sequential numbered navigation corrected them.
URL-as-click-reference calls were rejected and retained. Only matching successful
reads support this ledger; rejected calls are not counted as verified source.

No application runtime/source edits or inspection, tests, PostgreSQL execution, Git command,
provider mutation, remote message, branch, release or merge occurred.
PR applicability has separate
[design](OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_OUTCOME.md).
