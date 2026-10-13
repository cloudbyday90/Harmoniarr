# Open PR applicability for root-authority coordination

October 13, 2026. GitHub MCP repository search and metadata identify
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr) and its pull
endpoint. Pages one and two return three open heads and a terminal empty page.
MCP changed-file lookup confirms the affected paths.

| PR | Immutable observed head | Existing local evidence |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Controlled fixture Compose; [replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Release workflow; [replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Release workflow; [replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |

Heads/bases match the previous [applicability record](OPEN_PR_APPLICABILITY_ROOT_COSTS_2026_10_OUTCOME.md).
All observed heads already have local replay evidence. The new applicable set
is empty; no random draw, duplicate implementation or merge is warranted.
Preserve governed runtime/action pins. Main only; no release.

A final MCP refresh confirms the same three immutable heads/bases and terminal
empty page. Git fetch confirms main remains aligned with the reviewed baseline
`86c3915f8995967633148bcd36d36b4a1ec64e79` before publication.
