# Open PR applicability for single-track acquisition

October 12, 2026. GitHub MCP repository search identified
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr). Repository
metadata supplied the pull-list endpoint. Open collection pages 1 and 2 returned
three non-draft PRs and a terminal empty page. MCP changed-file calls checked each
revision across their paginated file lists.

| PR | Observed head / base | Changed file | Applicability |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | Same revision already replayed and tested locally; [outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 / 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | Same revision already replayed and tested locally; [outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 / 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | Same revision already replayed and tested locally; [outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

The applicable unreplayed set is empty. No random draw, repeat replay, downgrade
or merge is justified. This follows the
[applicability design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).
The collection is an observation, not an atomic snapshot or a claim about future
PR availability. A final two-page collection refresh returned the same three
head/base revisions and a terminal empty page; the applicable unreplayed set
remains empty.
