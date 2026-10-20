# Native partial-transfer outcome

October 20, 2026. Implemented the [design](NATIVE_PARTIAL_TRANSFER_DESIGN.md) and
[research stack](NATIVE_PARTIAL_TRANSFER_RESEARCH_2026_10.md) as a separate opt-in
ESM lane: `npm run validate:native-slskd-partial`. Production classifiers already
reject these failures; no production service, schema, dependency or retry-default
change was needed.

Actual slskd 0.26.1 / wire 0.26.1.0 produced these observations:

| Scenario | Declared / retained bytes | Native terminal state | Application classification / GET recovery |
| --- | --- | --- | --- |
| Complete control | 65,553 / 65,553 | Completed, Succeeded | succeeded / confirmed |
| Graceful EOF one byte short | 131,089 / 131,088 | Completed, Errored | failed / unknown |
| TCP reset after partial receipt | 98,311 / 32,791 | Completed, Errored | failed / unknown |

Each case used one actual application POST, native 201 and one before-send hook,
with exact provider/file/receipt identity checks. Admission confirmation remains
distinct from successful completion. The reset case deliberately lost the
completed HTTP response; reconciliation used GET and did not issue another POST.
Both failed receipts contained exception evidence. Before reset, the inspector
observed 32,791 bytes in the actual incomplete file; final receipt and retained
prefix agreed. This is an observed result, not a guarantee that every RST delivers
all locally queued bytes.

After the native client's tracked downloads emptied, the harness stopped the
acknowledged provider container and verified its stopped state before final
inspection. Completed storage contained only the successful control; incomplete
storage contained exactly the two failed prefixes. All content hashes and stable
descriptor/path identities passed. Kernel filesystem inspection confirmed two
4 MiB tmpfs volumes. Provider writes and inspector read-only access were verified
separately; the project used an internal network, no published ports, non-root
processes, read-only roots and dropped capabilities. Strict cleanup passed.

The final frozen source contained 3,083 files with SHA-256
`c6eb27c65e5826d435cc83dfc93a1f0f8b2c5884d1b5290984d62a7265924c92`.
Validation against that source:

- Focused controls: 23 passed, including seven new adverse tests for real FIN/RST,
  checkpoint cancellation preserving Error/null, partial-file refusal, volume
  ownership and producer retirement before inspection.
- Fast gate: 10,585 tests passed (5,500 server, 4,388 client, 697 scripts), with
  static checks, lint and build, in 139.04 seconds.
- Four native cases / nine scenarios passed without skips: partial faults
  (25.74 seconds), full-file completion (15.60 seconds), and queue/response-loss
  controls on 0.26.1 and 0.26.0. The full-file regression retained four exact files
  totaling 319,534 bytes. Every case used the same frozen source and rebuilt
  application image; all disposable resources were retired.

The unchanged database and three-minute timeout owners did not require repeating
their longer inventories. Private source, build, native and readiness evidence
remains under `.tmp/native-partial-2026-10-20/`. The
[Docker outcome](LOCAL_DOCKER_NATIVE_PARTIAL_OUTCOME.md) records the no-cache
walkthrough rebuild. The independently selected
[PR 48 evaluation](OPEN_PR_48_NATIVE_PARTIAL_EVALUATION.md) retained the unchanged
incompatible candidate without reinstalling or merging it. Testing and web
standards skills now route this fault/retirement method to focused references.

This lane uses one total provider attempt to attribute each fault precisely. It
does not qualify default retries/resume, music decoding or library import.
Next: bounded native default-retry/resume qualification with explicit nonzero
offsets, exact receipt/batch identity and final hashes, while the application
continues to send only one POST. No release or application branch was created.
