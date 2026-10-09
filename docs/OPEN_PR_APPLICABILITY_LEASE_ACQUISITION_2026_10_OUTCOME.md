# Lease acquisition open-PR applicability outcome

Recorded 9 October 2026 local and UTC. The eligible unreplayed set is empty.
No random draw, redundant replay, downgrade, patch application or merge applies.
Selection rules are in the separate
[design](OPEN_PR_APPLICABILITY_LEASE_ACQUISITION_2026_10_DESIGN.md).

## Fresh discovery and pagination

GitHub MCP search rediscovered
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID 1221894481, at 20:50:05 UTC. Full metadata at 20:50:19 returned
the [REST repository](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}.
Collection requests were expanded from that returned template.

| Request | 9 October UTC | Observed result |
| --- | --- | --- |
| [Initial page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 20:50:27 | Three open nondraft PRs: 40,24,23 |
| [Initial page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 20:50:27 | Empty array |
| Individual metadata and complete paginated filenames | 20:51:16 | Historical heads/bases and one file each |
| [Final page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 20:51:42 | Same heads/bases |
| [Final page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 20:51:42 | Empty array |
| Final individual metadata rechecks | 20:51:42 | All three heads/bases unchanged |

## Exact scope comparison

| PR | Current and recorded replay head | Base | Complete changed filename | Prior replay |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Metadata action](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Build/push action](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Node 26.7 fixture](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Replay designs/outcomes and the
[prior comparison](OPEN_PR_APPLICABILITY_ABANDONED_PREPARATION_2026_10_OUTCOME.md)
record historical scope. Every fresh identity/scope matches. Unchanged full
patches were not fetched or executed again merely to repeat prior work.

## Retained artifacts and limits

All artifacts are under ignored .tmp/lease-acquisition-2026-10/.

| Artifact | SHA-256 |
| --- | --- |
| repository-discovery.json | bd6383e1c38ff4f5f5e4e70b0290ac4cfba7bb7d4af34de5f388328b1bbbb7e0 |
| open-pr-collection.json | 366b26b024cb581f8f1ee83050accd475b7f05d143abb99fef3614a30b95fa13 |
| head-scope-comparison.json | f65ba370bbfb1237ec1fdc6b06793b8f3e989e6e4f4a82185222204137c1dc3c |

Reads are separate and non-atomic. Link headers were not exposed; explicit
initial/final empty page2 responses establish the observed boundary. Future
changes require another assessment. Root reports clean main
734ee6cdf13123e6b412e294bb499d16b86eed1d. No runtime edit/test, PostgreSQL
operation, Git mutation or external write occurred.

## Final current check: 9 October 2026

A further GitHub MCP read used the same discovered repository pulls template.
[Page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
and [page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
were requested at 22:16:02 UTC and completed at 22:16:03: three entries followed
by an explicit empty page. Full individual metadata reads completed at
22:16:26 UTC; all three remain open with these exact unchanged identities.

| PR | Final head | Final base |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa |

Complete file scopes inherit the 20:51:16 paginated filename reads above:
PR23/24 each change .github/workflows/release-image.yml; PR40 changes
compose.controlled-provider-fixture.yaml. Exact head and base equality establishes
unchanged immutable patch scope; no new filename fetch was needed. The eligible
unreplayed set remains empty, with no random draw, replay, downgrade or merge.

Raw pages, full metadata and comparisons are retained in
.tmp/lease-acquisition-2026-10/final-open-pr-recheck-2026-10-09-2216.json,
SHA-256 596e34f8958a7f669e27e67ee82789354247a9187fa35908f66804f7b436fcc5.
These separate reads are non-atomic; Link headers were not exposed. Explicit
empty page2 establishes the observed boundary. No runtime/test edit, PostgreSQL
operation, Git operation or external mutation occurred during this recheck.
