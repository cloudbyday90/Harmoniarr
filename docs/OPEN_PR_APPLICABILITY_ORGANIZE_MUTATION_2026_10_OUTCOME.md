# Organize mutation open-PR applicability outcome

Recorded 9 October 2026 local and UTC. No eligible unreplayed patch was found.
No draw, redundant replay, downgrade, patch application or merge applies.
Rules are in the separate
[design](OPEN_PR_APPLICABILITY_ORGANIZE_MUTATION_2026_10_DESIGN.md).

## Fresh discovery and pages

GitHub MCP rediscovered
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID 1221894481, at 22:28:18 UTC. Full metadata at 22:28:41 returned
the [REST repository](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}.
Collection URLs were expanded from that returned template.

| Request | 9 October UTC | Result |
| --- | --- | --- |
| [Initial page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 22:28:51 | Three open nondraft PRs: 40,24,23 |
| [Initial page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 22:28:51 | Empty array |
| Individual full metadata and complete paginated filenames | 22:30:19 | Same historical heads/bases and one file each |
| [Final page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 22:31:36 | Same three heads/bases |
| [Final page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 22:31:36 | Empty array |
| Final individual full metadata | 22:31:36 | All immutable heads/bases unchanged |
| Later page1/page2 recheck during complete validation | 22:51:47 | Same three open entries; page2 empty |
| Later individual full metadata | 22:52:11 | Exact heads/bases unchanged; changed_files=1 each; no eligible unreplayed patch |
| Precommit page1/page2 refresh | 23:18:53 | Same three open entries; page2 empty |
| Precommit individual full metadata | 23:19:20 | Same exact replayed heads/bases and one-file scopes; eligible set empty |

## Exact comparison

| PR | Current and recorded replay head | Base | Complete changed filename | Prior replay |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Metadata action](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Build/push action](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Node 26.7 fixture](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Replay designs/outcomes and the
[preceding comparison](OPEN_PR_APPLICABILITY_LEASE_ACQUISITION_2026_10_OUTCOME.md)
record historical scope. Every fresh identity/scope matches. Full unchanged
patches were not fetched/executed again merely to repeat prior work.
The later check reuses the complete filename scopes read at 22:30:19 because
their immutable head/base pairs remained unchanged; it does not claim a second
full file-list fetch.

## Raw evidence and limits

Artifacts are under ignored .tmp/organize-mutation-2026-10/.

| Artifact | SHA-256 |
| --- | --- |
| repository-discovery.json | 6d5038d81d8dfb67599fa2a4de9bc701d02e0ac1756aac29862f2782c16ad624 |
| open-pr-collection.json | 2c874612dfb890590b31ac9fc825f2a758ea1e3403999f7713c0fbd6f925f1a5 |
| head-scope-comparison.json | c50dfe00ed43a6f451f808782ebbed7387310e904e942dad02fa9868339d4d90 |
| final-open-pr-recheck-2026-10-09-2252.json | 08bc9cae604aff4b399ca302d9c9ba19b14fb60676b158432436150747d2dab6 |
| precommit-open-pr-recheck-20261009-231920.json | 16498e085443a4cd8abf6f6be614ff32b909c1bd83a459f07e990c21ea65d74b |

Separate reads are non-atomic. Link headers were not exposed; initial/final empty
page2 responses establish the observed boundary. Future changes require a new
assessment. Root reports clean main 5b52135f8bce389a284e6c01b8996df7cbf029dc.
The later artifact stores the relevant returned raw API fields, not duplicated
full payloads, and parsed successfully. Its collection and metadata URLs were
returned/discovered by MCP rather than guessed.
No runtime edit/test, PostgreSQL operation, Git mutation or external write occurred.
