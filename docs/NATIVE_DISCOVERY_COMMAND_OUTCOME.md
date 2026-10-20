# Canonical discovery through native acquisition outcome

October 20, 2026. Implemented the [design](NATIVE_DISCOVERY_COMMAND_DESIGN.md)
and [official research/tradeoffs/stack](NATIVE_DISCOVERY_COMMAND_RESEARCH_2026_10.md)
in narrow ESM fixture and command helpers. The existing opt-in audio lane now
starts from synthetic metadata, durable monitoring and real filesystem settings.
Actual wanted/discovery reconciliation produces the projections. No candidate,
candidate file, search result, selected status or ready execution plan is seeded.
Synthetic artists have no public MusicBrainz identity, keeping artwork local.

Authenticated Find matches records intent for two different recipient accounts.
Same-key replay returns identical results; a distinct-key repeated intent reports
the existing intent without starting preparation again. The second recipient's
command coalesces onto the active discovery run. Required initial-search audit
retains the administrator actor separately from each recipient.

Five search refusals passed before any search transport traffic: anonymous (401),
missing CSRF (403), out-of-scope recipient (404), forged recipient body (400), and
disabled target (409). No discovery run or candidate exists after those refusals.
The retained ten selection/start refusals also pass, with no selection or
execution side effect. Different-key starts while execution is active still fail.

The actual operation queue claims one discovery run. Its configured worker runs
wanted/discovery reconciliation, real HTTP client/service and actual response
normalization, scoring and ingestion, then completes with two dispatched searches,
four candidate files and zero failed requests. Two equally scored sources per
release remain pending for manual review; no selection/readiness policy is
replaced. Exact discovery/search/candidate/release/file correlation and refreshed
Missing Music permissions pass. The owned HTTP server observes exactly two search
POSTs and two response GETs, then closes through its awaited owner.

Actual Use match and Start download continue through real planning, queue, worker,
durable handoff, required actor audit and queued Activity. Each native provider
transfer completes one 352,844-byte file. Valid PCM passes ffprobe, canonical apply,
exact target hash, required system audit and scheduled scan with one catalogue
row. Equal-size corrupt content completes transfer but fails inspection, retains
its source and publishes no apply operation, target or catalogue row. Existing
native retirement/export/hash and resource cleanup contracts remain active.

Final frozen source: 3,122 files, SHA-256
f078c1b16d5efcb15e9b40440e776aa8140b89d8ca17491558ab2c49dc909f66.
The final fast gate passed 10,616 tests (5,529 server, 4,390 client, 697 scripts),
static checks, lint and builds. The final native case passed in 37.8 seconds
excluding the outer launcher, with no skips or cancellations. It used the rebuilt
immutable app image recorded in the [Docker outcome](LOCAL_DOCKER_NATIVE_DISCOVERY_OUTCOME.md).
Unrelated retry/timeout matrices and unchanged browser flows were not repeated.
This strengthens one explicit scenario; it does not establish whole-suite speedup.

Retained prototypes include an initial fingerprint failure after a fixture-file
rename and an incorrect expected HTTP 202. Keeping the existing helper path and
asserting the actual Find matches 200 contract corrected those fixture mistakes.
A later prototype passed before final provenance/replay assertions were added;
only the final frozen run supports the complete result above. Private artifacts
remain under .tmp/native-discovery-2026-10-20/.

The standards skill now has a focused discovery-provenance method connecting
W3C, IETF, OWASP and database guidance to concrete owners and evidence. Canonical
actions/testing references were updated; all three skill entrypoints passed the
skill validator. [PR 48](OPEN_PR_48_NATIVE_DISCOVERY_EVALUATION.md) was refreshed
through MCP and remains incompatible; its unchanged failed candidate and passing
consumer evidence were reused without another install or merge.

Next: extend the isolated native fixture with bounded server search and compressed
peer search responses, then feed those actual slskd API responses into this lane.
That closes the controlled-HTTP search boundary while preserving decompression,
frame, recipient and resource limits. This slice proves real client/ingestion
with owned HTTP responses and native file transfer separately. It does not prove
native Soulseek search, public-network search, rendered command submission,
full media decoding, remote-source authentication or general WCAG conformance.
Application runtime bytes and production policy are unchanged. No release,
Git tag, new application branch or PR merge was created.
