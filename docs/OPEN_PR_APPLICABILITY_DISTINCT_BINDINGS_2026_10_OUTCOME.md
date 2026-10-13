# Open PR applicability: distinct binding profile

Consulted 2026-10-13 through GitHub MCP: repository metadata, open pulls pages
1/2, all three changed-file lists and selected #24's exact patch. Page two is
empty. Node crypto.randomInt selected #24 uniformly from three open pulls.

| PR | Immutable head | Applicability |
| --- | --- | --- |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Workflow build-push action 7.2 is superseded by current 7.4 pin; already locally replayed |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Workflow metadata action 6.1 is superseded by current 6.2 pin; already locally replayed |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Controlled fixture Node 26 bump conflicts with the retained Node 24 stack; already evaluated |

Heads/files remain unchanged from the earlier [#24 replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md),
[#23 replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) and
[#40 evaluation](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md). Those are historical
executions, not new tests this round. Zero applicable unreplayed patches exist;
no duplicate replay, dependency downgrade, PR merge or release is performed.

## Authorized stale PR cleanup

After the user requested cleanup or rebasing, each PR was refreshed immediately
before changing its state. All three heads still matched the reviewed SHAs.
GitHub MCP closed #40 at 19:08:42 UTC, #24 at 19:08:44 UTC and #23 at 19:08:45
UTC on October 13. Returned snapshots confirm state closed and merged false.
The subsequent open-pulls collection is empty. PR bodies, branch histories and
dependency/update configuration were preserved; no rebase or merge occurred.

Rebasing #23/#24 would still propose superseded pins; #40 would still conflict
with the supported Node 24 stack. Closing removes obsolete proposals while
retaining the historical local evaluations. Recommendation: review a newly
applicable patch when one exists; keep implementation on main without a release.
