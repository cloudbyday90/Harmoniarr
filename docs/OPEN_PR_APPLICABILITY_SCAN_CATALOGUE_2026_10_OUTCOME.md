# Scan catalogue open-PR applicability outcome

Recorded 9 October 2026 local, with the precommit check on 10 October UTC.
The eligible unreplayed set is empty.
No draw, redundant replay, downgrade, application or merge applies.
Rules are in the separate
[design](OPEN_PR_APPLICABILITY_SCAN_CATALOGUE_2026_10_DESIGN.md).

## Fresh discovery and collection

GitHub MCP rediscovered
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID 1221894481, at 23:43:49 UTC. Full metadata at 23:44:25 returned
the [REST repository](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}.
Collection requests were expanded from that returned template.

| Request | UTC timestamp (October 2026) | Result |
| --- | --- | --- |
| [Initial page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 23:44:50 | Three open nondraft PRs: 40,24,23 |
| [Initial page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 23:44:50 | Empty array |
| Full individual metadata and complete paginated filenames | 23:45:31 | Same historical heads/bases and one file each |
| [Final page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 23:45:46 | Same three heads/bases |
| [Final page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 23:45:46 | Empty array |
| Final full individual metadata | 23:45:46 | All immutable heads/bases unchanged |
| Precommit page1/page2 refresh | Oct10 00:07:14 | Same three open entries; page2 empty |
| Precommit individual full metadata | Oct10 00:07:47 | Exact replayed heads/bases unchanged; changed_files=1; eligible set empty |
| Final-policy page1/page2 refresh | Oct10 00:24:51 | Same three open entries; page2 empty |
| Final-policy individual full metadata | Oct10 00:25:20 | Exact replayed heads/bases and one-file scopes unchanged; eligible set empty |

## Exact replay comparison

| PR | Current and recorded replay head | Base | Complete changed filename | Prior replay |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Metadata action](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Build/push action](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Node 26.7 fixture](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Replay designs/outcomes and the
[preceding comparison](OPEN_PR_APPLICABILITY_ORGANIZE_MUTATION_2026_10_OUTCOME.md)
record historical scope. Fresh identities/files all match. Full unchanged patches
were not fetched/executed again merely to repeat prior work.
The precommit check reuses the complete filenames read on October 9 at 23:45:31
because their immutable head/base pairs remained unchanged. It does not claim a
second complete file-list fetch. Local clock was October 9, 20:07:47 EDT.
The final-policy refresh retains the same immutable pairs and complete scope
provenance. Local clock observed October 9, 20:25:21−04:00; its artifact contains
the relevant returned API fields rather than duplicated full payloads.

## Raw artifacts and limits

Artifacts are under ignored .tmp/scan-catalogue-2026-10/.

| Artifact | SHA-256 |
| --- | --- |
| repository-discovery.json | 6e2776990dd8d299ca736b13066d1e4d72405e3a72cc799a6dee1bf7303c1171 |
| open-pr-collection.json | a10a27dd612b7f70af749f7a2601bc352b96c23ce3d88ea74e4b9844c91594a7 |
| head-scope-comparison.json | a6d0f2748b228e6b799728df27c2b862621ec619dd1be9fe561c886f523f8086 |
| precommit-open-pr-recheck-20261010-000747.json | a35280e381231a3c33c08e25b560b83f3448efec1f378d4f37db5f163851cc90 |
| final-policy-open-pr-recheck-20261010-002520.json | c71b5274e35864b4b01e58a69a9eb8e1119420618da88701937e0d78949518fa |

Separate reads are non-atomic. Link headers were not exposed; the explicit empty
page2 on both reads establishes the observed boundary. Future changes require
another assessment. Root reports clean main 041458d. No runtime/test edit,
PostgreSQL operation, Git mutation or external write occurred.
