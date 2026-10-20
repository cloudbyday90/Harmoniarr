# Native search qualification outcome

October 20, 2026. Implemented the [design](NATIVE_SEARCH_DESIGN.md) and
[official-source/tradeoff stack](NATIVE_SEARCH_RESEARCH_2026_10.md) in narrow ESM
codec, responder, API CLI and bridge modules. Removed the obsolete controlled
HTTP search-response server. Application runtime policy is unchanged.

The owned central fixture captures an authenticated client's address and stable
announced port, permits identical login replay and routes two exact declared
queries with distinct original tokens. Zero is accepted as the released client's
initial token. Four bounded zlib peer responses carry exact WAV filename, size,
bitrate, duration, sample rate and depth. Only the owned client's zero-share
startup statistics are answered. Unknown targets, queries, endpoints and repeated
authority refuse before outbound admission.

Actual slskd API search starts return HTTP 200 with one POST each. The bridge
returns immediately; Harmoniarr's real ingestion polling observes the provider's
default-duration search and response publication. No provider database row,
candidate or response is seeded. Native state/body projections correlate with
the original central query/token and both peer payload records. Search count
updates, socket writes, final response publication and candidate ingestion stay
separate evidence boundaries.

The existing canonical path still owns saved monitoring, reconciliation, Find
matches, durable intent/replay, shared run coalescing, required actor audit and
five pre-search HTTP refusals. Real ingestion creates four equally paired matches.
Manual selection/start, ten further initial refusals, queued Activity and actual
planning/execution continue through native file transfer. Valid PCM is inspected,
applied with its exact hash, system-audited and catalogued once. Equal-size corrupt
content completes transfer, fails inspection, retains its source and publishes no
apply operation, target or catalogue row.

Six new fast tests independently inflate emitted frames, compare exact metadata,
exercise zero/max tokens and manifest refusal, prove real socket delivery and
duplicate authority refusal, reject invalid central endpoints/queries/statistics,
and abort/drain a held delivery at shutdown. Receiver EOF is deliberately
distinguished from sender close; shutdown can cancel a delivery still awaiting
that close. Strict native provider/socket/project and media/SQL cleanup remains.

Final source: 3,126 files, SHA-256
17a69692d34c211e38f085b4c66392a914f56f70768ce048c314c159c3d3f1b9.
The fast gate passed 10,622 tests (5,535 server, 4,390 client, 697 scripts),
static checks, lint and builds, with no skips or cancellations. The first gate
found four new-test lint issues; naming/promise executors were corrected before
the final freeze. The final native case passed in 68.5 seconds excluding the
outer launcher, with no skips or cancellations. It used the rebuilt immutable
image in the [Docker outcome](LOCAL_DOCKER_NATIVE_SEARCH_OUTCOME.md). Exact native
tokens were 0 and 1; plain peer payloads were 131/141 and 133/143 bytes, with
compressed sizes 110/113 bytes per query, all below the 4,096-byte caps. Native
API projections confirmed two responses/two files for each completed query.
Unrelated timeout/retry matrices and unchanged browser flows were not repeated.
This is expanded coverage, not a whole-suite speedup claim.

Retained prototypes/probes exposed incorrect fixture assumptions about a year
term, repeated port announcements, initial zero token, search HTTP status and
response-body publication timing. Released source and actual observations drove
the corrections. No application eligibility or provider filtering was bypassed,
and default search duration was preserved. Failed attempts remain private under
.tmp/native-search-2026-10-20/; they are not counted as passing evidence.

The standards skill's [native search method](../.agents/skills/harmoniarr-web-standards/references/native-search.md)
connects W3C provenance, OWASP input limits and released implementation semantics
to actual owners. Canonical actions/testing references were updated; all three
skill entrypoints passed their structural validator. [PR 48](OPEN_PR_48_NATIVE_SEARCH_EVALUATION.md)
remains incompatible and unapplied, with unchanged consumer evidence reused.

Next: reproduce and harden ingestion when the provider's completed flag/counts
precede response-body publication, including queued-start budget and cancellation.
The released service updates completed state before its final response write;
the application currently performs one immediate response read on completion.
That source ordering motivates focused tests; this run does not reproduce every
finalization race or establish a production timing guarantee. Cross-process API
bridging adds its own latency. Isolated owned search also does not establish
public-network discovery, directory browsing, rendered command submission,
full media decoding, remote-source authenticity or general WCAG conformance.
No release, tag, new application branch or PR merge is created.
