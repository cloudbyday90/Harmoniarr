# Canonical native selected-match acquisition outcome

October 20, 2026. Implemented the [design](NATIVE_CANONICAL_COMMAND_DESIGN.md)
and [official-source stack/tradeoffs](NATIVE_CANONICAL_COMMAND_RESEARCH_2026_10.md)
by strengthening the existing opt-in validate:native-slskd-audio lane. Narrow ESM
helpers own authenticated commands, refusals and actual queued execution.
Candidates begin pending; the fixture no longer writes selected status,
execution runs/items or a ready planning summary.

Actual Missing Music detail resolves each controlled match. An authenticated
administrator selects a match for a different target account, then explicitly
starts download preparation. Same-key selection/start replay returns identical
results with one selection event, one execution run, one queued Activity event
and required user audit per candidate. A different-key start while active is
refused. Persisted actor identity differs from recipient and matches events/audit.

Ten initial HTTP refusals passed: anonymous detail (401), out-of-scope detail
and selection (404), requester start (403), missing selection/start CSRF (403),
another release's match (404), no selected match (409), and disabled-target
selection/start (409). They leave both candidates pending with no selection event
or execution run. The actual database CHECK still rejects an unknown Activity
type. No provider work is admitted by these controls.

The canonical queue claims each real run and starts the application's configured
worker. Its real planner, lease, pre-provider and durable handoff owners confirm
one actual native POST/201 per candidate after awaited beforeSend. Refreshed
decision permissions and the bounded Downloader handoff resolve the actual
wanted release and recipient without provider/path fields.

Both 352,844-byte valid/corrupt WAVs completed native transfer. Actual completed
receipts, retired-producer read-only inspection and hash-preserving export remain.
The valid file passed ffprobe, safe auto-add/apply, exact canonical hash, required
system audit and scheduled scan with one observed catalogue row. The equal-size
corrupt control failed media inspection, retained its source and created no
apply operation, target or catalogue row. Strict worker/SQL/reader/socket/Docker
cleanup passed. See the preceding [media outcome](NATIVE_AUDIO_IMPORT_OUTCOME.md)
for unchanged PCM/hash contracts.

Frozen source: 3,120 files, SHA-256
1e926000a84251f04ad58fc8278e785de6c5162070ad9ddeb6ab1069f1d47379.
Final fast validation passed 10,616 tests (5,529 server, 4,390 client, 697 scripts),
static checks, lint and builds. The selected native case passed in 43.05 seconds
excluding the outer Node launcher. Both focused Activity browser cases passed,
and real source/snapshot comparison passed 138 anchors. No final test skipped
or cancelled work. Unchanged native retry/timeout inventories were not repeated.

The first canonical prototype passed but reproduced discarded queued Activity.
The [Activity outcome](QUEUED_DOWNLOAD_ACTIVITY_OUTCOME.md) records that product
fix and the retained browser failure that exposed routine-link suppression.
A fast-gate lint failure in a browser evaluation was corrected with
element.ownerDocument; only that test changed after the build/schema comparison.
Their production inputs remained identical. Existing Vue lifecycle warnings
remain in the passing client log.

The [Docker outcome](LOCAL_DOCKER_NATIVE_CANONICAL_OUTCOME.md) records the no-cache
upgrade; [PR 48](OPEN_PR_48_NATIVE_CANONICAL_EVALUATION.md) remains incompatible.
Testing, canonical-actions and web standards skills now include the real command
and event-admission method. Private evidence is in .tmp/native-canonical-2026-10-20/.

Next: connect canonical Find matches and actual discovery ingestion into this
pipeline, replacing controlled search-result rows. This proof covers authenticated
HTTP commands and separately controlled-feed rendered Activity; it does not
establish live discovery, rendered command submission, full media decoding,
valid same-size remote-source authentication or general WCAG conformance.
No release, Git tag, new application branch or PR merge.
