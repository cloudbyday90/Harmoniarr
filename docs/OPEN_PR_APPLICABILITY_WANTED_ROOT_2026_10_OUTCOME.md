# Open PR applicability for Wanted root lookup work

October 2026. GitHub MCP search identifies
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr); repository
metadata supplies the pull-list endpoint. Two collection pages return three
open non-draft PRs and a terminal empty page. Fresh changed-file lookup confirms
only the release workflow for 23/24 and controlled fixture Compose file for 40.

| PR | Observed head / base | Existing local evidence |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Metadata action replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Build action replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 / 4429a4d6146b16bde16ba01298d39a5d2494e0aa | [Controlled image replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

The pre-publication MCP collection refresh returns the same head/base pairs and
terminal empty second page.

These immutable changes already have local evaluation evidence; the unreplayed
applicable set is empty. No random draw, duplicate replay or merge is warranted.
Keep the governed Node 24 runtime and established action pins. If a new applicable
head appears, evaluate/test that immutable patch locally without merging. Main
only; no release.
