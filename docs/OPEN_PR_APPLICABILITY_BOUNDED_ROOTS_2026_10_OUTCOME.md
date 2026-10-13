# Open PR applicability for bounded root reads

October 13, 2026. GitHub MCP search and repository metadata identify
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr) and its pull
endpoint. Pages one/two return three open heads then a terminal empty page.
Changed-file lookup confirms the following paths and immutable heads.

| PR | Observed head | Existing local evidence |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Controlled fixture Compose; [replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Release workflow; [replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Release workflow; [replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |

Heads/bases match the previous [record](OPEN_PR_APPLICABILITY_ROOT_AUTHORITY_2026_10_OUTCOME.md).
All observed revisions already have local evidence, leaving no new applicable
set for a random draw. Preserve governed pins; no duplicate replay, merge or
release. Revisit an applicable immutable revision when one appears.

A final MCP refresh confirms the same heads/bases and terminal empty page.
Git fetch confirms main remains aligned with reviewed baseline
`4d59887666e3d488e1141b771fd91a03aa25b3aa` before publication.
