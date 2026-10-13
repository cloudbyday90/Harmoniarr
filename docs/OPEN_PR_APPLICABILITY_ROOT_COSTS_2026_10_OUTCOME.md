# Open PR applicability for root-cost profiling

October 13, 2026. GitHub MCP repository search and fetched metadata identify
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr) and its pull
endpoint. Pages one and two return three open PRs then a terminal empty page.
MCP changed-file lookup confirms each affected path.

| PR | Immutable observed head | Path / existing local outcome |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Controlled fixture Compose; [local replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Release workflow; [local replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Release workflow; [local replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |

Heads and bases are unchanged from the preceding [applicability record](OPEN_PR_APPLICABILITY_CLOSED_GROUPS_2026_10_OUTCOME.md).
Every observed head already has local evidence; the new applicable set is empty.
No random draw, duplicate implementation or merge is warranted. Revisit a future
applicable immutable revision. Main only; no release.

A final MCP refresh confirms the same three immutable heads/bases and terminal
empty page. Git fetch confirms main still aligns with the reviewed baseline
`9b96d78bca9fa02fc48a3507d261ea718e13f6a0` before this round's publication.
