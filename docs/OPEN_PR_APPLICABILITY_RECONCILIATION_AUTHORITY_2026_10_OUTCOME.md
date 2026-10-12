# Open PR applicability: reconciliation publication authority

Assessed October 12, 2026 through GitHub MCP repository discovery and fetched
metadata. Its returned PR collection template supplied paginated URLs: page 1
contains three open non-draft records; page 2 is empty. Each returned record URL
and complete changed-filename inventory was fetched. Follow the existing
[applicability design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).

| Open PR | Exact head / base | Complete scope | Existing local implementation |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` / `0b661a2a5a5e6318683ee980c3c5d02298987e9d` | `.github/workflows/release-image.yml` | [Replay 23](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` / `0b661a2a5a5e6318683ee980c3c5d02298987e9d` | `.github/workflows/release-image.yml` | [Replay 24](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` / `4429a4d6146b16bde16ba01298d39a5d2494e0aa` | `compose.controlled-provider-fixture.yaml` | [Replay 40](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

The eligible unreplayed set is empty: no random draw or duplicate patch is useful.
No merge, PR mutation, branch, tag or release is part of this round. The final
two-page refresh before publication returned the same open/non-draft numbers
and exact head/base revisions, with an empty second page.
