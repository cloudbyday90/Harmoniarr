# Native deterministic file-transfer design

October 20, 2026. Extend the isolated native slskd fixture with a separate opt-in
file mode. Preserve the existing message queue and three-minute timeout modes.
No application production policy or dependency upgrade is needed for this slice.

Declare four small deterministic binary files, filenames, sizes and SHA-256
digests. They are synthetic protocol payloads, not encoded music. Use actual
slskd 0.26.1 and the released Soulseek.NET 10.0.2 direct-transfer path: a framed
PeerInit, raw token, raw 64-bit offset, then file bytes. Keep peer initialization,
message framing and raw negotiation in narrow ESM modules. Refuse unknown/reused
tokens, wrong peers, nonzero resume offsets, oversized/truncated inputs and extra
negotiation bytes. Send bounded chunks and await owned asynchronous sends during
cleanup, preserving the first Error/null.

For file mode only, share a Docker-managed 4 MiB tmpfs volume: writable by the
provider and read-only in the companion inspector. Verify actual project/volume
identity, mount access and tmpfs options. Keep uid 1000, read-only roots, no
published ports and the existing inspected internal network. Remove the volume
before deleting owned secrets, using the existing strict runtime cleanup owner.

Drive two-file direct and controlled completed-response-loss batches through
the actual application client/service. Recover the latter by GET with no second
POST. Require exact receipt IDs, batch UUID, peer, filename, size, terminal success
and byte counts. Separately await published files: the released provider persists
terminal state before moving files, so status cannot stand in for filesystem
completion. Verify bounded content hashes and descriptor/path identity through
read-only inspection. Refuse wrong identity reads and assert no extra files.

Fast tests own parser splits/coalescing, bad/replayed tokens, bounded sends,
retirement and adverse file identity/content checks. The explicit native file lane
owns real binary/filesystem proof. Do not add Docker to the fast gate, seed
provider records or infer music decoding, library import or general path-mapping
coverage from these synthetic bytes. Run affected native modes based on changed
owners, then one final fast gate on frozen source. Keep local PR evaluation and
walkthrough rebuild results in separate documents.
