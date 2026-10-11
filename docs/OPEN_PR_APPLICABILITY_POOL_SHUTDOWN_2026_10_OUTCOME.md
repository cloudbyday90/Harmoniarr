# Open PR applicability: pool shutdown outcome

October 11, 2026. GitHub MCP repository discovery and repository metadata supplied
the repository and pulls URLs. Open page 1 contains three PRs; explicit page 2 is
empty. Each complete PR record is open, non-draft and changes one file; complete
filename lists were fetched independently. Apply the eligibility method in the
[previous design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).

| PR | Head | Base | Complete scope / prior local test |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml; [replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

These immutable pairs and scopes match the preceding assessment and recorded
local replays. Eligible unreplayed set is empty, so no random draw or duplicate
implementation is applicable. No remote PR write, merge or release occurred.
Raw discovery, repository metadata, both pages, complete records and scopes are
retained in `.tmp/app-pool-lifetime-2026-10-11/pr-mcp.json`. This is a bounded
observation of these pages, not an atomic or all-time absence claim.

The final MCP page refresh after the full gate again returned these three open,
non-draft PRs and an empty terminal page. Their immutable base/head pairs are
unchanged, so the complete recorded scopes and prior replay outcomes still
apply. Eligible set remains empty. Responses are retained separately in
`.tmp/app-pool-lifetime-2026-10-11/pr-final-refresh.json`.
