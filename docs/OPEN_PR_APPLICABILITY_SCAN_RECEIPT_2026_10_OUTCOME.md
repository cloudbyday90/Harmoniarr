# Open PR applicability for scan receipt invalidation

October 12, 2026. GitHub MCP repository search identified
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr); repository
metadata supplied the pull-list endpoint. Pages one and two returned three open
non-draft PRs and a terminal empty page. Changed-file lookup confirms only the
release workflow for 23/24 and the controlled fixture Compose file for 40.

| PR | Observed head / base | Existing local evaluation |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Metadata action replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Build action replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 / 4429a4d6146b16bde16ba01298d39a5d2494e0aa | [Controlled image replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Final pre-publication MCP refresh returns the same head/base pairs and terminal
empty second page; remote main still matches baseline `4e3ee28`.
The eligible unreplayed set is empty under the existing
[applicability design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).
No random draw or repeated replay applies. Collection observations are not an
atomic snapshot or future availability claim. No PR merge or release.
