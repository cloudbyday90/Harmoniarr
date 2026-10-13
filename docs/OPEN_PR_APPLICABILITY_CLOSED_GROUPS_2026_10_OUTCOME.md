# Open PR applicability for closed receipt groups

October 13, 2026. GitHub MCP search identifies
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr); fetched
metadata supplies the pull endpoint. Pages one/two return three open non-draft
PRs and a terminal empty page. Changed-file lookup confirms controlled fixture
Compose for 40 and the release workflow for 23/24.

| PR | Observed immutable head / base | Existing local evaluation |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 / 4429a4d6146b16bde16ba01298d39a5d2494e0aa | [Controlled image replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Build action replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Metadata action replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |

All observed heads already have local evidence. The new applicable set is empty;
no random draw, duplicate replay or merge is warranted. Retain governed runtime
and action pins. Evaluate a future applicable revision as an immutable local
patch. Main only; no release.

A final MCP refresh confirms the same three heads/bases and terminal empty page.
Remote main remains the reviewed baseline
`e0236b99b5b3f3f00b87e7d92181ec2e65a65e4a` before publication.
