# Tag snapshot open-PR applicability outcome

Recorded 9 October 2026 local / 10 October UTC. No eligible unreplayed patch
was found. No draw, duplicate replay, downgrade, application or merge applies.
Rules are in the separate
[design](OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_DESIGN.md).

## Fresh discovery and collection

GitHub MCP rediscovered
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID 1221894481, at 10 October 02:28:17 UTC. Full metadata at 02:29:52
returned the [REST repository](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}.
Collection requests were expanded from that returned template.

| Request | 10 October UTC | Result |
| --- | --- | --- |
| [Initial page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 02:30:28 | Three open nondraft PRs: 40,24,23 |
| [Initial page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 02:30:28 | Empty array |
| Full individual metadata and complete paginated filenames | 02:32:18 | Same historical heads/bases and one file each |
| [Final page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 02:35:16 | Same three heads/bases |
| [Final page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 02:35:16 | Empty array |
| Final full individual metadata | 02:35:16 | All immutable heads/bases unchanged |
| Precommit collection and exact metadata refresh completed | 03:00:21 | Three open entries, then empty page2; exact heads/bases unchanged; eligible set empty |

## Exact replay comparison

| PR | Current and recorded replay head | Base | Complete changed filename | Prior replay |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Metadata action](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Build/push action](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Node 26.7 fixture](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Replay designs/outcomes and the
[preceding comparison](OPEN_PR_APPLICABILITY_SCAN_CATALOGUE_2026_10_OUTCOME.md)
record historical scope. Fresh identities/files all match. Full unchanged
patches were not fetched/executed again merely to repeat prior work.
The precommit check reuses the complete filenames read at 02:32:18 because the
immutable head/base pairs remained unchanged. It does not claim another full
file-list fetch. Local completion time was October 9, 23:00:21 EDT.

## Raw evidence and limits

Artifacts are under ignored .tmp/tag-snapshot-2026-10/.

| Artifact | SHA-256 |
| --- | --- |
| repository-discovery.json | b175f3dfc33af6135ab66b5a719f076b83c31f0d05966fa2cf824beb10ece04d |
| open-pr-collection.json | 2181a7463350ed6cc9386ac44a4179cdd7edfceb809d849d56433748a5089446 |
| head-scope-comparison.json | cdcae58b1a3d01811f892c32dd52f464178dd9a274bb37ef4d3fef7806034ced |
| pr-precommit-refresh-20261010-0300.json | 978efaaf1472077c3717b5283f18b272210565968cf0f19c3e0a11155541f3e0 |

Reads are separate and non-atomic. Link headers were not exposed; initial/final
empty page2 establishes the observed boundary. Future changes require a new
assessment. Root reports clean main cab4e73. No runtime/test edit, PostgreSQL
operation, Git mutation or external write occurred.
