# Pre-provider refusal open-PR applicability outcome

Recorded 9 October 2026 local and UTC. The eligible unreplayed set is empty.
No random draw, patch application, redundant replay, downgrade or merge applies.
Selection rules are in the separate
[design](OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_DESIGN.md).

## Fresh discovery and pagination

GitHub MCP search rediscovered
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID 1221894481, at 19:09:21 UTC. Full metadata at 19:11:45
returned the [REST repository](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}.
Collection requests were expanded from that returned template.

| Request | 9 October UTC | Observed result |
| --- | --- | --- |
| [Initial page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 19:11:53 | Three open nondraft PRs: 40,24,23 |
| [Initial page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 19:11:53 | Empty array |
| Per-PR metadata and complete paginated filename tool | 19:12:07 | Unchanged heads/bases and one file each |
| [Final page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 19:12:58 | Same three heads/bases |
| [Final page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 19:12:58 | Empty array |
| Final individual metadata rechecks | 19:12:58 | All three immutable heads/bases unchanged |

## Exact scope comparisons

| PR | Current and recorded replay head | Base | Complete changed filename | Prior replay |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Metadata action](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Build/push action](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Node 26.7 fixture](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Replay designs/outcomes and the
[preceding immutable comparison](OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_OUTCOME.md)
record the historical scope. Every fresh identity/scope matched. Full unchanged
patches were not fetched or executed again merely to repeat prior work.

## Retained evidence and bounds

JSON artifacts are under ignored .tmp/pre-provider-refusal-2026-10/.

| Artifact | SHA-256 |
| --- | --- |
| repository-discovery.json | dbb3092da380f19bd297f0ae2e84e4aa8b55b09c8e0fd3b75be2c0665acd906c |
| open-pr-collection.json | 4f0eca8033d91b6968b375913167948148e2b0e831dfeff720039d679129f2ca |
| head-scope-comparison.json | ebeaaddf9397717e7777e72628b313efda5a172fae5c51ab3f0d647fb9882bf5 |

Reads are non-atomic. No HTTP Link headers were exposed; both explicit empty
page2 responses establish the observed boundary. Future rebases/openings require
another assessment. Root supplied baseline 12b9c11; no Git command verified it.
No runtime edit, test, PostgreSQL execution or external mutation occurred.
