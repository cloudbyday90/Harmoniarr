# Open PR applicability for private delivery recovery

October 12, 2026. GitHub MCP repository search identified
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), and fetched
metadata supplied its pull-list endpoint. Pages 1 and 2 returned three open
non-draft PRs and a terminal empty page. These head/base pairs match the earlier
[shared-pilot assessment](OPEN_PR_APPLICABILITY_SHARED_PILOT_2026_10_OUTCOME.md).
MCP paginated changed-file lookup confirms that 23/24 change only
`.github/workflows/release-image.yml` and 40 changes only
`compose.controlled-provider-fixture.yaml`.

| PR | Observed head / base | Prior local evaluation |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Release metadata action replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | [Build action replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 / 4429a4d6146b16bde16ba01298d39a5d2494e0aa | [Controlled provider image replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Final pre-publication MCP refresh again returns the same three head/base pairs
and a terminal empty second page; remote main still equals baseline `6d40849`.
The eligible unreplayed set is empty under the existing
[applicability design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).
No random draw, repeated replay, release workflow or merge is warranted. These
are collection observations, not an atomic snapshot or future-availability claim.
