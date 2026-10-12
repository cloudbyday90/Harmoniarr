# Open PR applicability for the shared PostgreSQL pilot

October 12, 2026. GitHub MCP repository search identified
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), and fetched
repository metadata supplied its pull-list endpoint. Two collection pages
returned three open non-draft PRs and a terminal empty page. MCP paginated
changed-file lookup verified each current revision.

| PR | Observed head / base | Changed file | Assessment |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | Same locally evaluated revision; [outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | Same locally evaluated revision; [outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 / 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | Same locally evaluated revision; [outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

The eligible unreplayed set is empty under the existing
[applicability design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).
No random draw, repeated replay or merge is warranted. This is a collection
observation, not an atomic snapshot or a future-availability claim.

Final two-page MCP refresh returned the same three head/base pairs and a terminal
empty page. No new eligible revision appeared before publication.
