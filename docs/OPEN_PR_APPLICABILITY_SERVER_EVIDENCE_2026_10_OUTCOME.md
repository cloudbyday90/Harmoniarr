# Open PR applicability: owned-server evidence outcome

October 11, 2026. GitHub MCP repository discovery identified cloudbyday90/Harmoniarr
and metadata supplied its pulls template. Open page 1 contains three PRs and
explicit page 2 is empty. Full records and complete changed-file scopes were
fetched. Use the existing [eligibility design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).

| PR | Immutable head | Immutable base | Complete scope / prior local replay |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml; [replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

All are open/non-draft with one changed file. Pairs/scopes match the
[previous assessment](OPEN_PR_APPLICABILITY_APPLY_LIFETIME_2026_10_OUTCOME.md)
and existing replay evidence. The eligible unreplayed set is empty, so no random
draw or duplicate replay is applicable. No downgrade, remote PR write or merge
was performed. MCP responses are retained locally in
.tmp/postgres-failure-evidence-2026-10-11/mcp-evidence.json.
This is a bounded observed collection, not an atomic or all-time absence claim.

The final two-page MCP refresh returned the same three immutable head/base pairs
and an empty second page. Previously fetched complete scopes remain applicable;
no eligible unreplayed patch appeared. Raw refresh responses are retained in
pr-final-refresh.json beside the initial evidence. No remote PR was changed.
