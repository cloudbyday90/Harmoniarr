# Open PR applicability: apply lifetime outcome

October 11, 2026. GitHub MCP repository discovery supplied the repository URL;
metadata supplied its pulls template. Open page 1 contains three PRs and explicit
page 2 is empty. Complete PR records are open/non-draft with one changed file;
complete scopes were fetched separately. Reuse the eligibility method in the
[prior design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).

| PR | Head | Base | Complete scope / existing evidence |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [prior replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [prior replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml; [prior replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Pairs and scopes match the previous [assessment](OPEN_PR_APPLICABILITY_POOL_SHUTDOWN_2026_10_OUTCOME.md)
and existing local replay records. Eligible unreplayed set is empty. No random
draw, duplicate replay, downgrade, remote write or PR merge is applicable this
round. Raw responses are retained in
`.tmp/apply-worker-lifetime-2026-10-11/pr-mcp.json`. This is a bounded observed
collection, not an atomic or all-time absence claim.

A fresh two-page MCP refresh during final validation again returned the same
three open/non-draft immutable head/base pairs and an empty second page. Their
previously fetched complete scopes therefore remain applicable evidence; the
unreplayed set is still empty. Raw refresh responses are retained separately
in `pr-final-refresh.json`. No remote PR was changed.
