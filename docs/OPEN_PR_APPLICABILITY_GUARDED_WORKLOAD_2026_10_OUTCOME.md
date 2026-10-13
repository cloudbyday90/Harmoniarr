# Open PR applicability for guarded Wanted workload profiling

October 13, 2026. GitHub MCP repository search identifies
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr); fetched
metadata supplies the pull collection endpoint. Pages one/two return three open
non-draft PRs and a terminal empty page. Changed-file lookup confirms the
controlled fixture Compose file for 40 and release workflow for 23/24.

| PR | Observed immutable head / base | Existing local evaluation |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 / 4429a4d6146b16bde16ba01298d39a5d2494e0aa | [Controlled image replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Build action replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Metadata action replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |

All three heads already have local evaluation evidence. The unreplayed applicable
set is empty, so no random draw or duplicate replay is warranted. Retain governed
Node/action pins. A future applicable revision should be tested as an immutable
local patch. Main only; no merge or release.

A final MCP refresh confirms the same three heads/bases and terminal empty page.
Remote main remains the reviewed baseline
`73e579edcafd1eb4236d17b3b6eff57ac096f553` before publication.
