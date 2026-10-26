# Backup directory creation design

October 26, 2026. Follows [directory checkpoints](BACKUP_DIRECTORY_SYNC_OUTCOME.md).

Replace recursive mkdir in the byte writer with a narrow ESM creation service.
The configured backup directory is the publication root; its existing parent is
the trusted anchor. Do not create or sync above that anchor. Refuse filesystem-root
configuration, paths outside the publication root, symlink/non-directory components
and more than 32 directory levels. Validate both recorded publication paths before
filesystem work. Existing directories retain their permissions; new ones use 0700.

Before a new temporary file opens, create directories explicitly from root to
leaf, without recursive mkdir. Verify directory identities, sync leaf-to-root and
then the anchor, await every sync/close and recheck identities/ownership. Every
attempt checkpoints the full accepted chain, including EEXIST components. A failed
earlier attempt or restart therefore cannot hide an unpersisted ancestor behind
"already exists". Keep private directories and the provisioned anchor trusted;
path checks do not provide hostile-namespace atomicity.

Recovery uses the same bounded service with creation disabled before verifying
or adopting publication bytes. Missing components defer the saved intent. When
the full directory chain exists but both file names are missing, existing recovery
can abandon the unwritten intent after checkpoints succeed. It cannot recreate
missing backup bytes from a checksum. Retain partial directories for a future
attempt; do not recursively remove them as speculative cleanup.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Recursive mkdir only | Simple | Does not request ancestor-entry persistence | Replace |
| Sync only mkdir's reported new paths | Less I/O | Retry/restart can lose earlier partial-creation knowledge | Reject |
| Walk to filesystem root | No extra configured boundary | Traverses unrelated ancestors and broadens authority | Reject |
| Bounded root-to-leaf creation and full leaf-to-anchor sync | Explicit retry-safe checkpoints; private new directories | Extra I/O; configured root's parent must exist and support sync | Adopt |
| New schema storing creation progress | More history | More crash states; still requires current identity/readiness | Defer |

Recommended stack: durable intent → bounded directory scope → owned nonrecursive
0700 creation → full chain/anchor sync and identity check → private write/sync/close
→ existing verified link/unlink directory checkpoints → SQL completion. Recovery
repeats directory preparation without mkdir. Keep byte writing free of directory
creation and compose existing factories instead of adding a process/singleton.

Validate order, bounds, EEXIST retry, partial mkdir/sync failures, lost ownership
and identity replacement with cheap tests. Native checks use a genuinely missing
configured root under an existing private anchor, actual files/PostgreSQL and held
cleanup; rerun affected backup entries. Freeze one bounded fast gate and perform
the no-cache walkthrough rebuild with preserved data/mounts. No schema/version/
release change. Current API success is not hardware power-loss or SQL/file atomicity
proof, and anchor provisioning remains a deployment responsibility.
