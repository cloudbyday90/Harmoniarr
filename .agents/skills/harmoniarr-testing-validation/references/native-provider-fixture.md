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

## Timeout cancellation and explicit retry

For slskd 0.26.1, read docs/SLSKD_0261_QUALIFICATION_DESIGN.md and its outcome.
The released enqueue guard is three minutes. A default peer inactivity failure
at 15 seconds does not exercise it. Use the separate opt-in timeout lane with
its owned 240-second socket/inactivity bounds; keep ordinary batch tests short.
Never patch the binary or shorten its guard to claim released behavior.

Withhold one declared peer acknowledgment, observe the original receipt's
terminal state, then explicitly submit one new batch for that same file. Compare
old/new immutable images and inspect the candidate's actual internal transfer
list before retry. A terminal database row alone does not prove internal task
retirement. Debug API evidence belongs to qualification, not production wiring.
Keep native POST response fields distinct from Harmoniarr's normalized result.
Record the failed fixture decoding attempt separately from provider evidence.

The host waits between completed bounded read commands; it does not abandon a
long-running Docker exec when the test times out. Preserve source identity and
strict provider/socket/project/file cleanup. Fixture-requested retry is not a
product auto-retry policy; unknown application POST results still recover by GET.
