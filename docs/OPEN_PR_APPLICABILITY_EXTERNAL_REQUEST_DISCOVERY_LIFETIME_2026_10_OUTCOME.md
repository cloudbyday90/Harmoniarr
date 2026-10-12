# Open PR applicability: external request discovery lifetime

October 12, 2026. GitHub MCP discovered cloudbyday90/Harmoniarr; fetched metadata
supplied the pulls collection template. Open page 1 contains three open/non-draft
PRs; explicit page 2 is empty. Full records and complete file scopes were fetched.
Reuse the [existing eligibility design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).

| PR | Immutable head | Immutable base | Complete scope / existing replay |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml; [replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

All full records contain one changed file. Immutable pairs and scopes match the
[previous assessment](OPEN_PR_APPLICABILITY_PROVIDER_INGEST_LIFETIME_2026_10_OUTCOME.md)
and replay records. Eligible unreplayed set is empty; no random draw, duplicate
replay, downgrade or merge applies. No remote PR was changed. Raw responses remain
privately in .tmp/external-request-discovery-lifetime-2026-10-12/mcp-evidence.json.
This is a bounded observation, not an atomic or all-time absence claim.

Two-page refresh before the fixture correction and final publication refresh
returned the same immutable head/base pairs and empty page 2. Previously fetched
complete scopes remain applicable; eligible unreplayed set is still empty. Raw
responses are retained separately in pr-final-refresh.json and
pr-publication-refresh.json. No remote PR was changed.
