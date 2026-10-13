# Open PR applicability for Wanted verification diagnostics

October 12, 2026. GitHub MCP repository search identified
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr); repository
metadata supplied the collection endpoint. Pages one/two return three open,
non-draft PRs and a terminal empty page. Fresh changed-file lookup confirms the
same release workflow for 23/24 and controlled fixture Compose file for 40.

| PR | Observed head / base | Existing local evidence |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Metadata action replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Build action replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 / 4429a4d6146b16bde16ba01298d39a5d2494e0aa | [Controlled image replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

The pre-publication MCP refresh returns the same head/base pairs and terminal
empty second page. Remote main still matches baseline
`a7c48b144157ccc5a3547e0b7269d8fd673da39e`.

All observed immutable changes already have local evaluation evidence; the set
of unreplayed applicable PRs is empty. No random draw, duplicate replay or merge
is warranted. Keep the governed Node 24 runtime and established action pins.
If a new applicable head appears, evaluate and test that immutable patch locally
without merging. Main-only development and no release remain the user constraints.
