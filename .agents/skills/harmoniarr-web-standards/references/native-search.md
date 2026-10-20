# Standards method for native search evidence

Use when replacing controlled search responses with an actual provider binary.
Read the [design](../../../../docs/NATIVE_SEARCH_DESIGN.md) and
[source/tradeoff stack](../../../../docs/NATIVE_SEARCH_RESEARCH_2026_10.md).

Resolve the released provider's linked library and tag through MCP metadata,
then read request, response, file and token implementations at that identity.
Do not infer a private protocol from a newer branch or fixture assumptions.
Soulseek.NET 10.0.2 starts at token zero and repeats the same listen port during
login. Accept those reviewed semantics while refusing token reuse and changed
endpoint authority. A token is correlation data, not authentication.

Apply OWASP input limits before scheduling: declare queries/peers/files, capture
the authenticated central connection's address and port, cap both plain and
compressed payloads, and bound delivery counts and socket lifetime. Independent
bounded test inflation checks the emitted format; native API observations prove
released-binary acceptance. Neither supplies a general provider decompression
security assessment.

Apply W3C provenance guidance by inference: retain source/runtime identity and
query/token/peer/payload correlation. Separate socket write, native response,
candidate ingestion, native transfer and inspected publication. Preserve the
actual HTTP status: native search returns 200, while transfer batch acceptance
returns 201. One search POST must not turn into repeated intent during polling.

Close admission and await socket/task retirement. A receiver seeing bytes is
earlier than sender close: shutdown may cancel that still-owned delivery. Test
these boundaries separately rather than waiting an arbitrary duration. Keep
fast controls and one explicit native scenario, with failed prototypes retained.
This proves isolated owned search, not public-network discovery, directory browse,
rendered commands, remote content authenticity or general standards conformance.

For completed-state/publication gaps, read the separate
[design](../../../../docs/SLSKD_SEARCH_PUBLICATION_DESIGN.md) and
[research](../../../../docs/SLSKD_SEARCH_PUBLICATION_RESEARCH_2026_10.md).
Trace the vendor's actual state/count, finalization marker and body writes before
equating empty with zero. Test completion on the last normal poll, unavailable
queued start, final empty success, counter regression, failed search and
cancellation after an awaited read. A one-time publication allowance must never
reset itself. Preserve original read failures, check current authority during
waiting and retain the locked persistence guard. Do not retry the search POST.
Unavailable evidence must fail before candidate/audit publication and successful
no-match cooldown/exhaustion. Separate deterministic ordering controls from the
ordinary native case; the latter does not force an internal vendor database race.

For durable continuation, use
[the design](../../../../docs/SLSKD_SEARCH_CONTINUATION_DESIGN.md) and
[official tradeoffs](../../../../docs/SLSKD_SEARCH_CONTINUATION_RESEARCH_2026_10.md).
First verify the released API accepts caller-owned IDs. Commit the UUID and
owner/context/configuration binding before POST; only its reservation creator
may submit. Existing reservations use GET after restart or uncertain acceptance.
An absent record, expired continuation or changed connection never grants another
POST. Preserve ambiguity after a crash before sending; do not claim exactly once.
Trace the actual worker's claim and reconciliation cooldown too: persist pending
continuation before network work, match its claim/attempt, and clear it on durable
success. Retain current authority and locked publication checks. Prove real SQL
uniqueness/rollback, held HTTP acceptance, cancellation/configuration drift, and
native supplied-ID/read continuation as separate boundaries. Do not turn a native
ordinary success into proof of a lost-response fault that was not injected.

For operator recovery, read [the design](../../../../docs/SEARCH_RECOVERY_DESIGN.md)
and [current source tradeoffs](../../../../docs/SEARCH_RECOVERY_RESEARCH_2026_10.md).
An expired or absent search is an actionable stop, not an automatic retry grant.
Use the schema's actual blocked state and a bounded failure projection. Fence the
stop to the current claim, preserve it through reconciliation, and clear the old
claim marker when committing explicit Search again intent. Retain the previous
provider reservation; admit one new UUID only for the new generation. Reuse the
canonical target/maintenance/lock/audit/replay command instead of adding a second
queue. A historical Background Jobs recovery link only opens current decisions.
Do not apply shared-release consent to an approved external-request owner.

Prove stop and stale-stop refusal with real PostgreSQL, same-key HTTP replay,
unchanged no-match budget and old/new provider UUIDs. In the browser, prove the
read-only job handoff, keyboard activation, pending feedback outside busy state,
and focus after the refreshed result. Screen-reader announcements and complete
WCAG conformance require separate evidence. The owning native test is
`test/integration/missing-music-search-again.test.js`; the rendered recovery cases
are in `test/browser/missing-music-decision-detail-browser-acceptance.test.js`.
