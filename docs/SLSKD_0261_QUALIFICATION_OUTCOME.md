# slskd 0.26.1 qualification outcome

October 20, 2026. Adopted the reviewed slskd 0.26.1 image line from
[PR 51](https://github.com/cloudbyday90/Harmoniarr/pull/51) locally, without
merging it. Head `edf2825fa381d4f01f8b68434d90ff4a84c97fd9` remains open.
The production policy admits only the observed `0.26.1.0` wire form in addition
to existing supported identities. `0.26.1`, future revisions and canary strings
remain refused. Saved/prepared binding identity, before-send checks, receipt
validation and conservative unknown-result behavior retain their existing owners.

See the separate [design](SLSKD_0261_QUALIFICATION_DESIGN.md) and
[official research, options and stack](SLSKD_0261_RESEARCH_2026_10.md).

## Native timeout difference

Used the released immutable provider binaries on an inspected internal-only
network with no published ports. The timeout lane withholds the first peer ACK
and extends only its separate socket/peer inactivity bounds to 240 seconds. It
does not modify the released three-minute enqueue guard or normal test deadlines.

| Observed boundary | 0.26.0 control | 0.26.1 candidate |
| --- | --- | --- |
| Image ID | `sha256:ecd4026d4f8fb504e2cc55323efa2c1f5b56d20d3686b018249cc36b48ea17a6` | `sha256:588af49abc3088d639c8f1174d3bfad6e92c093a275a593140e3ac9311ebf6c4` |
| Wire version | `0.26.0.0` | `0.26.1.0` |
| Guard observed after start | 180.608 seconds | 181.026 seconds |
| Original receipt | Completed, TimedOut | Completed, Cancelled |
| Internal retirement before retry | Same-file retry remained blocked | Actual authenticated debug download list empty |
| Explicit new batch | HTTP 200, one failure, no new transfer | HTTP 201, new batch/receipt, Queued, Remotely |
| Peer requests | One withheld request | Withheld request plus one acknowledged explicit retry |
| Bytes transferred | Zero | Zero |
| End-to-end selected test duration | 196.7 seconds | 195.3 seconds |

Candidate proof also checks that its old receipt remains terminal after retry
and exactly one new internal download exists. Both final cases passed without
skips, closed all owned sockets, retired the fixture process successfully and
verified project containers/networks/volumes absent before deleting temporary
credentials/files. The host makes completed bounded Docker read commands while
the provider owns the asynchronous work; there is no abandoned long-running exec.

This establishes the selected timeout/cancellation/admission behavior. It does
not establish completed native media transfer, codec correctness, library import,
active-transfer cancellation, upload retry behavior or arbitrary provider support.
The debug endpoint is used only by qualification; production integration does
not depend on it. Fixture-requested retry does not introduce application resend.

## Evidence provenance and retained failures

Final timeout cases used source fingerprint (3,063 files)
`8270ca3e7d5378bcab3f28c091a43565ba8a8f53ca8d5a3591d10485147697e6`.
Afterward, only the managed Compose test's expected provider image changed from
0.26.0 to 0.26.1. Final source fingerprint is
`45835cb90c9a71effa7e8e082be5fce99748773bf93e3c87a3fe6e2dfe448aa8`.
The verifier compares every production/native code hash across these captures;
the test assertion delta is separate from native behavior evidence.

Retained `timeout-candidate-v1.log`: the harness incorrectly expected normalized
`enqueued` fields from the raw native response. Corrected it to the reviewed
`batch.transfers` / `failures` shape, then an intermediate candidate passed.
The first fast gate passed all server/client tests but failed the single stale
managed image assertion. The corrected gate is recorded separately; neither
failure is attributed to the provider or hidden by a timeout increase.

Private artifacts remain under `.tmp/slskd-0261-2026-10-20/`, including immutable
image IDs, individual source captures, raw test logs and cleanup evidence.
The rebuilt image and preserved walkthrough results have a separate
[Docker outcome](LOCAL_DOCKER_SLSKD_0261_OUTCOME.md).

The independently selected random [PR 52 evaluation](OPEN_PR_52_0261_EVALUATION.md)
adopts its single controlled-provider Node image delta after actual local
fixture-server testing. It does not change the application's Node 24 baseline.
No PR merge, release, Git tag or application branch was created.

## Final validation

- Focused policy/dispatch/fixture/Compose checks: 50 passed before freezing.
- Corrected `validate:fast`: 10,572 tests passed (5,487 server, 4,388 client,
  697 scripts), plus static policies, lint and production build; 98.86 seconds
  locally. This is an observation, not a matched whole-CI speedup measurement.
- Affected PostgreSQL handoff file: four passed, no skips; actual candidate wire
  identity persists, progressed lost responses do not resend, uncertain/stale
  evidence remains unresolved and required audit failure rolls back links/phase.
- Final native admission lane: one case/two scenarios on each provider image,
  16.7 seconds baseline and 13.6 seconds candidate. Each image produced four
  exact receipts with zero transferred bytes and GET recovery without another
  POST. Both used the new rebuilt app image as the canonical Node/lock companion.
- Final timeout lane: one passing selected case per image, as tabulated above.
- No-cache walkthrough rebuild, immutable artifact comparison, readiness-only
  acceptance and skill validation passed. The installed web standards reference
  matches the repository copy.

The long guard is isolated behind `validate:native-slskd-timeout`; no three-minute
test or Docker startup was added to `validate:fast` or the PostgreSQL inventory.

## Next recommendation

Extend the opt-in native fixture to transfer deterministic file bytes and prove
exact receipt completion and filesystem identity before claiming completed
downloads. Keep this separate from larger library-import authority tests.
When Node publishes the announced October 21 security patches, qualify the
actual Node 24 patch and the controlled fixture's Node 26 patch; do not invent
versions or claim those fixes are already present on October 20.
