# Native provider qualification

Use the explicit `npm run validate:native-slskd` lane for actual slskd batch
admission and exact receipts. It is separate from fast tests and PostgreSQL/HTTP
authority fixtures. Read docs/NATIVE_SLSKD_FIXTURE_DESIGN.md and its outcome.

1. Discover the released application/library source through MCP. Match the
   actual linked protocol version and immutable images; a newer default branch
   is not the released implementation. Keep the raw version guard unchanged
   until that candidate has separate evidence.
2. Require local immutable app/provider IDs. Inspect one internal network,
   read-only non-root containers/mounts, bounded storage and no published ports.
   Compare canonical Node, installed lock and mounted policy before API commands.
3. Generate disposable credentials and declare an owned peer/manifest. Refuse
   unknown identities, malformed/oversized/partial frames and duplicate files.
   Keep the protocol subset narrow; ignore only reviewed bounded notifications.
4. Require actual native 201 plus exact provider receipt IDs, caller batch UUID,
   peer, filename and size. Compare durable identity separately from later state.
   Prove wrong identities refuse and GET recovery does not POST again. Label
   client-side loss after native response completion accurately.
5. A Queued, Remotely receipt with zero transferred bytes is admission evidence,
   not a completed download or library import. Do not substitute provider DB
   seeding, health or an HTTP mock for this native claim.
6. Close admission and await owned socket/server close. Stop and acknowledge
   both containers, then verify project containers/networks/volumes removed
   before deleting bind data. Retain files after unacknowledged startup or
   uncertain retirement, and preserve the first Error/null after cleanup failure.
7. Freeze actual source and report selected native scope, failed candidates and
   platform limits. Keep this opt-in lane out of routine fast execution; a local
   duration does not establish a whole-CI performance improvement.
