# Open PR applicability outcome for file-match persistence

Fresh read-only GitHub MCP assessment on October 9 local / October 10 UTC, 2026.
The eligible unreplayed set is **empty**. No random draw, patch application,
redundant replay, downgrade, merge, release or remote write occurred.

## Discovery and collection

Repository search `Harmoniarr user:cloudbyday90` returned repository ID
`1221894481` and [cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr).
Fetching that returned URL provided
[repository metadata](https://api.github.com/repos/cloudbyday90/Harmoniarr) and
the actual `https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`
template. The initial search/discovery round was recorded at
2026-10-10 03:18:58 UTC (October 9, 23:18:58 EDT); the repository metadata
fetch followed it without a separately recorded per-call timestamp.

Both the initial and final collection reads returned three open PRs on
[page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
and an explicit empty
[page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2).
Complete metadata and filename scopes were read at 03:20:47 UTC. The final
collection and exact per-PR metadata recheck at 03:22:50 UTC
(October 9, 23:22:50 EDT) retained the same three pairs.

## Exact immutable comparisons

| PR | Head | Base | Complete changed-file scope | Earlier local evidence |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Replay outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

All three full filename lists were fetched freshly for this assessment.
The final unchanged immutable pairs permit reuse of those lists. Historical
heads/scopes come from the linked replay records; their recorded base pairs
were also checked against the preceding tag-snapshot applicability outcome.
All observed scopes are already locally replayed, so no new runtime replay is
applicable this round.

## Retained evidence and limits

Files are ignored research artifacts under `.tmp/file-match-2026-10/`.

| Evidence | SHA256 |
| --- | --- |
| repository-discovery.json | 0c10928b318dcfb091682588524dcee68724037843551d6a1bfeb10ec23cf053 |
| open-pr-evidence.json | 206415adac2d18b7288c7c8ead0b20a42ab4c341a2eb28c76f6269a09022ead7 |
| pr-historical-comparison.json | 39045080056795a673aea6edc60031041b4d7eba2bc904523bec0031722c102e |

The collection has a recorded terminal empty page; no Link-header evidence,
all-time absence claim or atomic snapshot is asserted. No tracked runtime or
test file, Git state or external service was mutated. Earlier replay and root
baseline/test evidence remain separate from this read-only assessment.

## Final precommit refresh

Fresh GitHub MCP reads at **2026-10-10 03:51:32 UTC**
(October 9, **23:51:32 EDT**) again returned three open PRs on the discovered
page-1 URL and an explicit empty page 2. Exact metadata for PRs 23, 24 and 40
reports each still open and non-draft, with one changed file and the same
head/base pair listed above.

The complete filename lists fetched at 03:20:47 UTC are reused solely because
those immutable pairs remain identical. Eligible unreplayed set: **empty**.
No draw, replay, application, downgrade or merge was performed.

Raw pages, exact metadata and comparisons:
`.tmp/file-match-2026-10/pr-precommit-refresh-20261010-0351.json`
SHA256: `4649ef711f67e7910b91d56e883f2cfbf85b54082069b80c33a0f4daf2dc968c`.

The refresh is a bounded paginated observation, independent of the root's
executed validation. It makes no atomic snapshot, Link-header or runtime-test claim.
