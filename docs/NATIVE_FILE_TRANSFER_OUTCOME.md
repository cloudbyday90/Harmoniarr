# Native file-transfer outcome

October 20, 2026. Added `npm run validate:native-slskd-files` as a separate
opt-in lane. The [design](NATIVE_FILE_TRANSFER_DESIGN.md) and
[official research/tradeoffs](NATIVE_FILE_TRANSFER_RESEARCH_2026_10.md) describe
its boundaries. All new JavaScript is ESM. No production service, route, schema,
dependency version or supported-provider policy changed.

## Implemented owners

- `peer-input.js` separates bounded framed initialization/message parsing from
  the raw transfer token/offset exchange. `soulseek-peer.js` owns one-file token
  capabilities and admitted sends, reducing the central fixture's responsibilities.
- `native-file-data.js` declares four deterministic .bin files. The sender streams
  chunks of at most 16 KiB with backpressure and awaited write completion. Socket
  closure and admitted-send drainage retain the existing fixture lifetime owner.
- `native-file-volume.js` verifies a project-owned local-driver tmpfs volume with
  a 4 MiB limit, uid/gid 1000 and noexec/nosuid/nodev options. The provider writes
  `/data/downloads`; the companion inspects the same volume read-only at
  `/downloads`. Both stay on one inspected internal network, with no published
  ports, read-only roots, dropped capabilities and disposable file credentials.
- `native-file-inspection.js` reads only declared paths, checks regular-file and
  single-link identity, uses no-follow open on Linux, bounds reads and rechecks
  descriptor/path metadata through content hashing and awaited close. The
  completed-files helper observes publication separately and refuses extra entries.

## Executed evidence

Final source: 3,072 files, SHA-256
`7440c710399b4add3da3659904a67c3cbbde72b82b5f731e96400dff8f58219d`.
The 14 changed/new non-Markdown files were frozen before final validation and
checked again afterward. Private evidence resides under
`.tmp/native-bytes-2026-10-20/`; generated data and secrets are not committed.

The final actual slskd 0.26.1 binary
`sha256:588af49abc3088d639c8f1174d3bfad6e92c093a275a593140e3ac9311ebf6c4`
reported `0.26.1.0`. It completed two two-file batches through the current
application client/service, one direct and one with controlled client-side loss
after the native 201 response body. GET recovery confirmed exact receipts without
a second POST. Both preserved caller batch UUID, peer, filename, size and receipt
identity, refused wrong identity reads, and reached Completed, Succeeded with
exact byte counts, no exception and an end timestamp.

| File | Bytes | Publication evidence |
| --- | ---: | --- |
| NativeBytes/file-1.bin | 65,553 | Exact SHA-256, stable descriptor/path identity |
| NativeBytes/file-2.bin | 131,089 | Exact SHA-256, stable descriptor/path identity |
| NativeBytes/file-3.bin | 98,311 | Exact SHA-256, stable descriptor/path identity |
| NativeBytes/file-4.bin | 24,581 | Exact SHA-256, stable descriptor/path identity |

Total 319,534 bytes. All four files had distinct device/inode identities. The
actual volume access/options passed inspection before commands; all four transfer
connections, owned sockets and sends retired. Project containers/networks/volumes
were verified absent before temporary files were removed. The final selected
file case passed in 27.0 seconds, without skips. An earlier intermediate native
run also passed; it is retained separately and is not a matched timing comparison.

Regression queue/lost-response cases passed on both 0.26.1 and 0.26.0, each with
four exact queued receipts and zero transferred bytes, in 19.6 and 16.2 seconds
respectively. These separate modes prove the shared message-parser extraction
retains admission behavior. All three final native runs used the rebuilt app
image as the canonical Node/lock companion and verified unchanged source.

Focused controls: 16 passed. They cover all parser splits/coalescing, wrong
identity/type/token/offset, suffix and partial EOF; real TCP capability refusal,
replay, exact bytes and held-negotiation close; bounded sender backpressure;
file content/size/hard-link/fabricated-manifest refusal; storage admission and
existing cancellation ACK withholding plus original Error/null cleanup behavior.

`validate:fast` passed all 10,578 tests: 5,493 server, 4,388 client and 697 scripts,
plus static policies, lint and build. Local elapsed time was 141.96 seconds under
concurrent build/validation load, not a matched performance benchmark. No Docker
startup or extra native matrix was added to the fast gate.

No PostgreSQL owner or application production code changed, so its unrelated
inventory was not repeated. The released three-minute guard/settings and timeout
runner were unchanged; focused cancellation-mode parsing/withholding remained
covered without repeating the long timeout comparison from the previous slice.
This is selected validation, not a claim of a new full integration run.

The [random PR evaluation](OPEN_PR_48_NATIVE_FILE_EVALUATION.md) retained the
unchanged TypeScript 7 failure and passed a fresh actual consumer control. No PR
was merged/rebased or dependency changed. The [Docker outcome](LOCAL_DOCKER_NATIVE_FILE_OUTCOME.md)
records the no-cache build and preserved walkthrough. Testing/web standards skill
references now route future work to the framing/raw, publication and evidence
boundaries; skill validation and local link/source checks accompany the commit.

## Limits and next recommendation

Synthetic binary completion proves native transport, receipt identity, bytes and
observed filesystem publication. It does not prove encoded music decoding,
truncated-transfer handling, active-transfer cancellation, resume, general path
mapping, library import or public-peer reliability. W3C provenance guidance is a
design inference, not conformance certification.

Next, add a bounded native partial-transfer/disconnect control and prove that an
incomplete payload cannot become a successful completed receipt or completed
file. Keep retry/resume policy explicit and retain partial data only in the
provider's incomplete area before extending proof into library import.
