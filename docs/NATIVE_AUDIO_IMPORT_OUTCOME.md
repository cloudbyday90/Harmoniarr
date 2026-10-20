# Native audio and canonical import outcome

October 20, 2026. Implemented the [design](NATIVE_AUDIO_IMPORT_DESIGN.md) and
[official-source recommendations](NATIVE_AUDIO_IMPORT_RESEARCH_2026_10.md) as
npm run validate:native-slskd-audio. All new code is ESM with narrow data, peer,
bridge, export, candidate, publication and catalogue helpers. Existing production
services, schema, dependency pins and user authorization policy are unchanged.

Actual slskd 0.26.1 / wire 0.26.1.0 completed both declared 352,844-byte files.
The real execution worker acquired its leased pre-provider authority and
durably confirmed each handoff. Each candidate made one application POST with
native 201 after its awaited beforeSend callback. Actual bound receipt summaries
reported completion; no accepted receipt or terminal state was fabricated.

| Control | Actual inspection | Canonical result |
| --- | --- | --- |
| Deterministic two-second stereo WAV | PCM s16le, 44,100 Hz, 16 bits, two channels | Safe automatic add, actual apply worker completion, original source moved, exact target hash, required system audit and completed scheduled scan with one observed catalogue row |
| Equal-size zero-filled corrupt WAV | media_inspection_probe_failed; no metadata | No automatic apply or import operation; source retained, target absent and no catalogue row |

Valid SHA-256:
ff580c0972d67d5f9d4631d5c16d86c9813d71c89f74a1d2ba5a5b213d42f6ea.
Corrupt SHA-256:
05d94a44b1a16c65a0f223ba7265fb1374f3d877a772dd657e4e668d5fc0da01.

The adapter invokes the actual slskd client/service on an internal network
without published provider ports. Receipt observations are captured while the
provider is alive. Native tasks retire and the exact provider is acknowledged
stopped before bounded read-only native inspection/export. Export refuses
overwrites, redirected parents, nonregular/multilink files, oversized bytes and
hash drift. It uses the shared bounded descriptor reader. Native/exported
filesystem identities differ; matching hashes join those stages. The isolated
ffprobe reader mounts only the scenario workspace, read-only with networking
disabled. Fresh PostgreSQL, actual workers, sockets, reader and Docker resources
retired through their existing owners.

Twelve new focused controls cover unaligned PCM ranges, corrupt bytes, fabricated
descriptors, token replay/offset/duplicate refusal, export redirection/content
refusal and held durable dispatch with Error/null preservation. They remain in
the fast gate. Frozen source: 3,114 files, SHA-256
004c9f7bcaaf8b5e6f8faee65ef1786f9f376a94b34b9c07294567c9207f5f88.
The final fast gate passed 10,613 tests (5,528 server, 4,388 client, 697 scripts),
static checks, lint and both builds, with no skipped tests. Existing Vue
lifecycle warnings remain in its retained log.

Seven final native cases / fifteen scenarios passed on this same frozen source
and image: audio/import, complete files, isolated EOF/reset, default resume,
exhaustion/size refusal, and queue/response-loss on both 0.26.1 and 0.26.0.
No case failed, skipped or cancelled. Unchanged three-minute timeout and broad
SQL inventories were not repeated; the new lane supplies its actual SQL proof.

The final native audio/PostgreSQL case passed on the rebuilt application image
in 54.50 seconds including setup and cleanup. A checkout timeout diagnostic
occurred during this passing run; its independent query/readiness checks passed,
but that does not establish the cause of the timeout. No timeout was widened.
Earlier failed harness prototypes are retained separately: missing dispatch
capabilities, strict filename refusal, original snapshot injection, missing
transcodeTemp readiness and a Windows catalogue path assertion. The corrected
prototype passed; final evidence uses the frozen code and rebuilt image.

The [Docker outcome](LOCAL_DOCKER_NATIVE_AUDIO_OUTCOME.md) records the no-cache
rebuild and preserved walkthrough. The [random PR evaluation](OPEN_PR_48_NATIVE_AUDIO_EVALUATION.md)
records fresh applicability checks and retained consumer evidence. Maintained
testing and web standards skills now route to the native-media boundary method.
Private logs and exact native evidence are under .tmp/native-audio-2026-10-20/.

Next: connect a canonical Music Queue selected-match action to this native
audio pipeline, replacing seeded ready eligibility while preserving the actual
durable command, inspection and publication checks. Current proof seeds wanted
metadata/candidate eligibility; it does not cover browser/search/discovery,
full audio decoding or authentication of otherwise valid same-size changed
remote content. No release, tag, new application branch or PR merge.
