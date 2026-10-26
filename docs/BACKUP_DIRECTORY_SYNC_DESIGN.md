# Backup directory synchronization design

October 26, 2026. Follows [file readiness](BACKUP_RECOVERY_READINESS_OUTCOME.md).

The actual configured Linux backup bind accepts directory open/sync/close. Require
that operation at publication/deletion checkpoints; a successful file sync alone
does not persist its directory entry. Keep a small ESM directory-sync service,
composed with current ownership in the existing facade, separate from byte writing
and SQL persistence. Open an existing regular directory read-only, constrain flags
where available, compare path/handle identity, await sync and one close, then
recheck current ownership and directory identity. Never retry an uncertain close.

Publication sequence: verified final bytes → sync final parent → remove only the
matching temporary name → sync temporary parent → finalized/catalog/completed.
This preserves the final-name checkpoint before temporary-name retirement. Both
parents are considered even if an interrupted intent names different directories.
When no temporary path exists, only the final parent is needed. Recovery repeats
the checkpoints after current file readiness; a missing temporary name does not
skip the directory-sync requirement for an earlier uncertain unlink.

Deletion sequence: verified unlink or current absence → sync parent → finalized →
catalog removal → completed. A missing file still requires parent sync. Missing,
unsupported, denied or failed directory sync leaves the prior journal phase and
inventory intact, with the existing bounded error-only diagnostic. There is no
silent best-effort or file-only fallback and no automatic directory recreation.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| File sync only | Current behavior; fewer calls | Does not request directory-entry persistence | Replace |
| Ignore unsupported/failed directory sync | More storage compatibility | Reports completion without this checkpoint | Reject |
| One sync after both link/unlink | Fewer flushes | No final-name checkpoint before retiring temporary name | Reject |
| Ordered directory sync with owned cleanup | Explicit namespace checkpoints; recoverable phase on failure | Extra I/O; storage must support directory sync | Adopt |
| New journal phases | More detail | Migration/state complexity; current phases already retain incomplete intent | Defer |

Recommended stack: existing file readiness and ownership → exclusive link/current
verified final → final-parent sync/close → inode-owned temporary cleanup →
temporary-parent sync/close → existing SQL completion. Deletion uses the same
parent-sync boundary after unlink/absence. No schema/version/release change.

Directory identity checks detect ordinary replacement, not arbitrary hostile local
namespace changes. Private parent directories and single-process ownership remain
assumptions. Syncing this directory does not persist newly created ancestor links,
make PostgreSQL/filesystem changes atomic, prove storage hardware flush behavior
or replace power-loss qualification. Unsupported storage remains incomplete until
repaired or moved to a supported deployment; Windows unit fixtures inject this
platform boundary and packaged Linux native checks exercise real sync.

Validate cheap order/error/cleanup checks first, then actual native publication,
deletion, unsupported/error injection and owner-loss drainage. Freeze one final
bounded fast gate and rebuild Docker without cache. Retain unrelated proof only
after exact source/runtime comparison; no new persistent service is introduced.
