# Origin-resolution open-PR applicability outcome

Recorded 9 October 2026. The eligible unreplayed set is empty. No draw, patch
application, repeated replay, downgrade or merge was applicable. Rules and
rationale are in the separate
[design](OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_DESIGN.md).

## Fresh repository and pagination evidence

MCP search rediscovered [cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID 1221894481, at 09:04:58 UTC. Metadata at 09:05:18 returned
the [REST repository](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}.
The collection URL was expanded from that returned template.

| Request | 9 October UTC | Observed result |
| --- | --- | --- |
| [Initial page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 09:05:34 | Three open nondraft PRs: 40,24,23 |
| [Initial page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 09:05:34 | Empty array |
| Per-PR metadata and complete filename tool | 09:06:08 | Heads/bases unchanged; one changed file each |
| [Final page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 09:06:53 | Same three heads/bases |
| [Final page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 09:06:53 | Empty array |

## Exact immutable comparison

| PR | Current and recorded replay head | Base | Complete changed filename | Prior replay outcome |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Metadata action](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Build/push action](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Node 26.7 fixture](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Earlier exact replay records and the preceding immutable comparison establish
the historical scope. All fresh identities/scopes matched. The complete patches
were not fetched/executed again merely to repeat unchanged work.

## Retained artifacts and limits

All JSON below is under ignored .tmp/origin-resolution-2026-10/.

| Evidence | SHA-256 |
| --- | --- |
| repository-discovery.json | fb9df4b6edae928bea9fafb300285c6088d63c1579012efa30815c997e202aef |
| open-pr-collection.json | 650d3d578108d385e3d8b7809106e15f40c9c5cf4ce5cf1c5bdc7deab2451940 |
| head-scope-comparison.json | 8fae12a3dce08957f0230806ba7c5781adb182bd98f2fca962a1692710c124b1 |

Reads were separate and non-atomic. HTTP Link headers were not exposed; explicit
empty page2 reads supply the observed boundary. Future openings/rebases require
another assessment. Root supplied baseline e08e658; no Git command verified it.
No runtime edit, test, PostgreSQL execution or external mutation occurred.
