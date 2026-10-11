# Open PR applicability: app checkout outcome

October 11, 2026, America/New_York. Fresh GitHub MCP discovery returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), ID 1221894481,
and repository metadata supplied its pulls template. Open page 1 returned three;
explicit page 2 returned zero. Full metadata and complete filename lists were
read independently: each PR is open/non-draft with one changed file.

| PR | Head | Base | Scope / prior local outcome |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml; [replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml; [replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Pairs/scopes match the preceding
[Downloader assessment](OPEN_PR_APPLICABILITY_DOWNLOADER_FILTER_2026_10_OUTCOME.md)
and replay records. **Eligible unreplayed set: empty.** No random draw, duplicate
replay, downgrade, remote PR write or merge occurred. Application diagnostics and
validation are separate from this read-only PR inspection.

Raw MCP discovery, metadata, pages, full records and complete scopes:
`.tmp/app-fixture-checkout-2026-10-11/pr-mcp.json`. Explicit terminal pagination
bounds this observation; no atomic or all-time absence claim is made.
Raw SHA256: `b810e25f76a7b081fb31ef4bfc662266163dc6ba6bc7cee5e0f1567841bc03cc`.

Final MCP refresh after the publication candidate's fast gate again returned
three open PRs and an empty terminal page. Full 23/24/40 records retained these
exact immutable pairs, open/non-draft states and one-file counts; complete
initial filename lists remain applicable. Eligible set remains empty.
Raw final responses: `.tmp/app-fixture-checkout-2026-10-11/pr-final-refresh.json`.
