# Harmoniarr development disk hygiene

Researched October 31, 2026 through MCP search and opened official sources.
See the [cleanup outcome](WORKSPACE_HYGIENE_OUTCOME.md) and maintained
[AI skill](../.agents/skills/harmoniarr-workspace-hygiene/SKILL.md).

## Ownership and retention

The Docker engine is shared with Classifarr and Duskcue. A Harmoniarr cleanup
must not remove those projects' stopped containers, rollback images, volumes or
build records. Review exact image metadata, all container references and current
pins; neither an untagged image nor an unused volume is sufficient project proof.
The October cleanup uses Harmoniarr-specific image environment keys/entrypoint,
reviewed per-run validation tag patterns, immutable IDs and exact fixture labels.

Preserve the live walkthrough, its five mounts and `.data` state, current tooling,
one app rollback and current qualification receipts. Old image provenance in a
historical report is not an obligation to retain every historical image forever.
Keep current named test/reader/media images rather than replacing or rebuilding
them during cleanup. Expired run-specific validation tags are reviewed after
seven days; age is a threshold for review, not authority to delete.

Files are assessed individually: retain reports, raw measurements, hashes,
recipes and archives, while removing selected reproducible outputs, old unpacked
replay actions and a superseded toolchain. Do not erase entire `.tmp` trees.
An old local-walkthrough PostgreSQL directory is preserved as data, despite its
temporary-looking parent. Protect secrets and `.data` unconditionally in routine
developer housekeeping. Do not modify application runtime maintenance policy.

Current fixture owners intentionally retain children after uncertain retirement.
A cleanup request can reclaim a genuinely orphaned synthetic resource after
fresh proof, but does not retroactively turn the old failed cleanup into a pass.
The [fixture cleanup contract](REUSABLE_WORKSPACE_CLEANUP_DESIGN.md) still applies
to ongoing work and task-owned teardown.

## Official guidance applied

| Source | Applicable practice |
| --- | --- |
| [Docker pruning](https://docs.docker.com/engine/manage-resources/pruning) | Pruning is explicit and can affect every unused object of a class. Use reviewed exact resources on this shared engine; unused volumes may contain valuable data. |
| [BuildKit disk usage](https://docs.docker.com/reference/cli/docker/buildx/du/) | Read JSON records, identify the selected builder and distinguish shared storage. Shared-record removal can reclaim only metadata while images retain layers. |
| [BuildKit prune selectors](https://docs.docker.com/reference/cli/docker/buildx/prune/) | ID/description/age and other selectors are available; multiple filters are ANDed. Preview the same selection with du and constrain mutation to reviewed IDs. |
| [Build garbage collection](https://docs.docker.com/build/cache/garbage-collection/) | GC can use age and storage budgets and differs by builder driver. A global builder budget affects other projects, so do not change it implicitly for this request. |
| [Git clean](https://git-scm.com/docs/git-clean) | Preview can use dry-run; ignored-file removal is still destructive. Prefer literal reviewed targets over repository-wide clean. |
| [PowerShell Remove-Item](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/remove-item?view=powershell-7.6) | Use LiteralPath for exact filenames. Canonical containment, reparse-point refusal and identity rechecks are additional project safeguards. |
| [Docker Desktop release notes](https://docs.docker.com/desktop/release-notes/) | Windows compaction behavior has changed across releases. Logical engine reclaim is distinct from physical host-disk return; do not promise shrinkage or shut down shared services to compact. |

## Options and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Host-wide prune | Fast and broad reclaim | Cross-project deletion and data loss risk. Rejected. |
| Age-only `.tmp`/image deletion | Easy to automate | Can erase databases, active fixtures or retained failure proof. Rejected. |
| Exact resource manifest with protected references | Reviewable ownership, bounded deletion, preserved rollback | More inventory work; some uncertain data stays. Selected. |
| Global daemon GC changes | Limits future aggregate cache | Shared-host policy and possible restart affect other projects. Deferred. |
| Lightweight AI housekeeping habit | Prevents repeat accumulation without another app | Depends on agents following the skill. Implemented. |

Keep one live app and one rollback, the current named qualification/tool set,
compact evidence and reconstruction inputs. Remove task-owned scratch after
acknowledged completion, review accumulated run images weekly during active work,
and check usage before large build batches. Preserve uncertain ownership rather
than extending a cleanup guess. No scheduler, second application service or
production database job is added. Record bounded receipts and verify image,
health, mounts and source after each cleanup.
