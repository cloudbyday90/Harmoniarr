# Open PR applicability: Downloader filter outcome

October 11, 2026, America/New_York. GitHub MCP repository search returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), ID
1221894481. Its fetched repository record supplied the actual pulls template.
Open page 1 returned three PRs; explicit page 2 returned zero. Full records and
complete filename lists were fetched independently; all are open, non-draft and
have exactly one changed file.

| PR | Head | Base | Scope / existing outcome |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | release-image.yml; [local replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | release-image.yml; [local replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml; [local replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Pairs/scopes match the preceding [catalogue assessment](OPEN_PR_APPLICABILITY_CATALOGUE_LIFECYCLE_2026_10_OUTCOME.md)
and replay records. The workflow file is `.github/workflows/release-image.yml`.
**Eligible unreplayed set: empty.** No random draw, downgrade, duplicate local
replay or PR merge occurred. Application work and validation are separate.

Raw discovery, repository metadata, pages, full records and complete filename
lists: `.tmp/downloader-filter-announcement-2026-10-11/pr-mcp.json`.
SHA256: `c6288f58ef933a17d518bb052a86d74c47dec12d734a5ad597c9c9d7c79bca10`.
This is the observed collection; it does not prove future absence or an atomic
snapshot. No remote PR writes, branch or release were performed.

Final MCP refresh after the stable fast gate again returned three open records
and an empty terminal page. Full 23/24/40 metadata retained the exact head/base
pairs, open/non-draft states and one-file counts above; complete initial filename
lists remain applicable to those unchanged immutable pairs. Eligible set remains
empty. Raw final responses: `.tmp/downloader-filter-announcement-2026-10-11/pr-final-refresh.json`.
