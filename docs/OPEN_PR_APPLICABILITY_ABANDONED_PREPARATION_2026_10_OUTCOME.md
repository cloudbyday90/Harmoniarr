# Abandoned preparation open-PR applicability outcome

Recorded 9 October 2026 local and UTC. No eligible unreplayed patch was found.
No draw, redundant replay, downgrade, application or merge applies.
Rules are in the separate
[design](OPEN_PR_APPLICABILITY_ABANDONED_PREPARATION_2026_10_DESIGN.md).

## Fresh repository and collection

GitHub MCP search rediscovered
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID 1221894481, at 20:10:09 UTC. Full metadata at 20:10:32 supplied
the [REST repository](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}.
Collection URLs were expanded from that returned template.

| Request | 9 October UTC | Observed result |
| --- | --- | --- |
| [Initial page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 20:10:42 | Three open nondraft PRs: 40,24,23 |
| [Initial page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 20:10:42 | Empty array |
| Individual metadata and complete paginated filename tool | 20:11:19 | Same historical heads/bases and one file each |
| [Final page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 20:12:03 | Same three heads/bases |
| [Final page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 20:12:03 | Empty array |
| Final individual metadata rechecks | 20:12:03 | All heads/bases unchanged |

## Exact immutable comparisons

| PR | Current and recorded replay head | Base | Complete changed filename | Recorded replay |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Metadata action](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Build/push action](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Node 26.7 fixture](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Replay designs/outcomes and the
[prior immutable comparison](OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_OUTCOME.md)
record historical scope. Fresh head/base/filename comparisons all match.
Unchanged full patches were not fetched or executed again merely to repeat them.

## Raw artifacts and bounds

All artifacts are under ignored .tmp/abandoned-preparation-2026-10/.

| Artifact | SHA-256 |
| --- | --- |
| repository-discovery.json | 15918e01bd0df897e93bb026da68cbd8c5e75b36fc33d1c2970dbb02ca7e6685 |
| open-pr-collection.json | b93865cf36d698f414aad45d457f0911f4a11bb7efae6a983db7bfbe2384ae23 |
| head-scope-comparison.json | 8b8a9a5e515310a67a4005d641e72b112c492404dd19b9fa47ca2f83d5e883e0 |

Reads are separate and non-atomic. No Link headers were exposed; initial and final
empty page2 responses establish the observed boundary. Future changes require
another assessment. Root reports clean main
f5525d4b53a009ffb42109cfe2c8b6cef52ae47c. No runtime edit/test, PostgreSQL
operation, Git mutation or external write occurred in this assessment.
