# Backup file-handle cleanup design

October 26, 2026. Follows [journal failure precedence](BACKUP_FAILURE_PRECEDENCE_OUTCOME.md).

The temporary writer currently closes in `finally`. A rejected close replaces
an earlier write/sync rejection, including null. A controlled baseline probe
reproduces this at both stages. Always attempt and await close once after a
successful open, but keep the original work failure as the returned failure.
After successful work, a close failure remains the returned failure.

Reuse the existing small `withWorkerTaskCleanup` ESM utility. It already owns
exactly this lifetime and uses an explicit failure flag rather than truthiness.
Keep mkdir/open admission, exclusive `wx`, private mode `0600`, write → sync →
close ordering and no normal publication before the writer settles. Do not add
a competing cleanup implementation or retry a failed close against uncertain
descriptor state. Open failure creates no owned handle to close.

Recommended stack: admitted private open → awaited write/sync → one awaited
close → original work failure, close-only failure, or success → existing journal
and verified-publication/recovery protocol.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Unconditional finally close | Always attempts close | Masks earlier failures | Replace |
| Ignore every close failure | Preserves primary | Hides failure after successful work | Reject |
| Wrap/aggregate both failures | Carries both | Changes Error/null identity; can expose raw internals | Reject |
| Reuse owned cleanup utility | Existing Error/null policy; no duplicate abstraction; awaits both | Secondary close rejection is suppressed when work already failed | Adopt |
| Retry close | May appear to recover | Resource state may already have changed | Reject without a stronger platform contract |

Qualify work-stage/close outcomes and delayed close using cheap tests. Guarded
native cases use actual private files and handles, with controlled write/sync/
close rejections. Explicitly distinguish a close callback rejecting after a real
successful close from an actual OS close failure. Prove the production facade
retains local admission through delayed cleanup, preserves journal phase, and
allows only fresh verified recovery after settlement. Do not infer fsync/power-loss
durability or actual descriptor retirement from an arbitrary close rejection.

PR #55 is the sole open candidate and is selected using recorded random selection.
Apply its exact music-metadata/strtok3 package patch on `main`, without merging.
Qualify supported media through the production tag adapter, plus the existing
guarded media scan workload; parser-sensitive prior results cannot simply become
new-version evidence because native codec binaries are unchanged.

No new production service, process, schema, application version or release. Keep
one final bounded fast gate, a no-cache walkthrough rebuild, preserved administrator/
data/five actual binds and explicit retained-versus-historical evidence.
