# Native exhaustion and size-refusal outcome

October 20, 2026. Implemented the [design](NATIVE_REFUSAL_DESIGN.md) and
[official-source stack](NATIVE_REFUSAL_RESEARCH_2026_10.md) in the separate opt-in
command npm run validate:native-slskd-refusal. Existing production failure and
recovery policies passed; no production service, schema or dependency changed.

Actual slskd 0.26.1 / wire 0.26.1.0 reported effective defaults resume, three
total attempts, configured delay 5,000 ms and configured maximum 60,000 ms.
Those settings were not overridden.

| Scenario | Native attempts / file connections | Final native state | Retained / declared bytes |
| --- | --- | --- | --- |
| Repeated one-byte-short EOF | 3 / 3 | Completed, Errored | 131,088 / 131,089 |
| Reset, then changed acknowledged size | 2 / 1 | Completed, Aborted | 32,791 / 98,311 |

The exhaustion path negotiated offsets 0, 131,088 and 131,088 with fresh tokens.
Each follow-up inspected the actual incomplete prefix and sent none of the
missing byte. The changed-size path first established real partial receipt,
then advertised 98,312 bytes on the second request. Native exception evidence
identified that size and the expected 98,311; no second file connection or third
request followed. Transient states were recorded without requiring every one
to be pollable.

Both application classifications remained failed, with exception evidence,
stable batch/receipt identity and no progressed-success evidence. Each scenario
made one application POST, native 201 and one before-send callback. Confirmed
admission remained distinct from final failure. The size-change case deliberately
lost the completed HTTP response; GET recovery remained unknown without another
POST. Wrong filename/size/peer/batch/receipt reads were refused.

After tracked native downloads emptied, the harness acknowledged the exact
provider stopped before final inspection. Completed storage contained no files.
Incomplete storage contained exactly the two expected prefixes, with matching
hashes, receipt byte counts and stable descriptor/path identities. Actual kernel
inspection confirmed two 4 MiB tmpfs volumes. Read-only inspector access,
provider-only writes, internal networking, no ports, uid 1000/read-only roots,
resource limits and dropped capabilities remained in force. Strict cleanup passed.

Frozen source: 3,101 files, SHA-256
44d09cb1d9c7b1338fbb4cd72ab5189b38bfc213f3e42998ec9ad4eb45be0ca6.
Twenty-nine focused tests passed, including nine new capability/offset, actual
EOF, held prefix/EOF callback Error/null and producer-retirement controls.
The final fast gate passed 10,601 tests (5,516 server, 4,388 client, 697 scripts),
static checks, lint and build in 123.35 seconds. Existing Vue lifecycle warnings
remain in the retained client-test log; this slice did not change client code.

Six native cases / thirteen scenarios passed against that same frozen source
and rebuilt application image: refusal, successful resume, single-fault
EOF/reset isolation, full completion, and queue/response-loss controls on 0.26.1
and 0.26.0. The refusal case took 48.42 seconds. No final case skipped or cancelled
work. Unchanged SQL and three-minute timeout owners did not require their long
suites. The passing prototype used an earlier source capture before the focused
test file was added; it is retained separately and is not the final gate.

The [Docker outcome](LOCAL_DOCKER_NATIVE_REFUSAL_OUTCOME.md) records the no-cache
rebuild and preserved state. The independent
[PR 48 evaluation](OPEN_PR_48_NATIVE_REFUSAL_EVALUATION.md) retains the unchanged
incompatible candidate after fresh applicability checks. Testing/web standards
skills now route exception-specific retry and incomplete-only proof to a focused
reference. Evidence remains private under .tmp/native-refusal-2026-10-20/.

Next: qualify a bounded valid-audio native download through media inspection and
canonical import, with a same-size corrupt-payload refusal control. Current
synthetic bytes establish transport boundaries, not decoding/import or
authentication of same-size changed remote content. No release, Git tag or new
application branch was created.
