# Open PR applicability outcome: catalogue fixture lifecycle/templates

October 10, 2026, America/New_York. Eligible unreplayed set: **empty**.
No random draw, patch application, redundant replay, downgrade, merge or remote write.

## Repository and complete observed collection

Fresh GitHub MCP search returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), repository
ID `1221894481`. Fetching that returned URL supplied its actual metadata and pulls
template `https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

[Open page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
at **22:07:22 UTC** returned three; [explicit terminal page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
at **22:07:23 UTC** returned zero. Full records and fresh complete filename lists
were read at **22:07:23 UTC**. Full metadata rechecks after filename collection at
**22:07:42 UTC / 18:07:42 EDT** retained all three immutable pairs, open/non-draft
states and one changed file per record.

## Exact comparison

| PR | Head | Base | Complete file scope | Prior local outcome |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Complete filename lists match every full record's one-file count. All pairs and
scopes match the current replay records and the
[preceding assessment](OPEN_PR_APPLICABILITY_LIBRARY_TEMPLATES_2026_10_OUTCOME.md).
No observed drift during filename collection. Every observed patch is already
locally implemented; numbers alone were not the exclusion rule.

## Retained evidence and limits

Raw fresh search, repository metadata, pages, full records, complete scopes,
rechecks and comparisons:
`.tmp/catalogue-test-lifecycle-2026-10/pr-applicability/open-pr-assessment.json`.
SHA256: `65dad4a4abaf64877fd6b31eb3b95a3b13efad49e6daa5a481558ac24ea2584c`.
Recorded **22:08:13 UTC**; observed host time
`2026-10-10T18:07:45.0120043-04:00`.

Explicit empty terminal pagination bounds the current collection observation.
No atomic snapshot, Link-header, all-time absence or researcher test claim. Root's
baseline, source implementation and validation are separately attributed. No
runtime/skill/README/tests/PostgreSQL/Docker/Git or remote mutations. Frozen.

## Final precommit refresh

October 10, America/New_York. Fresh GitHub MCP repository discovery began at
**22:53:36 UTC**, returning the same canonical repository metadata/pulls template.
[Open page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
at **22:53:37 UTC** returned three; [explicit terminal page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
at **22:53:38 UTC** returned zero. Full PR40/24/23 records at
**22:53:38 UTC / 18:53:38 EDT** remained open, non-draft, with exactly the heads
and bases above and one changed file each. This round's complete initial filename
lists were reused only for those unchanged immutable pairs/counts; current replay
records still match. Eligible set stays **empty**; no draw or replay.

Fresh raw discovery/pages/full records/comparisons:
`.tmp/catalogue-test-lifecycle-2026-10/pr-applicability/pr-precommit-refresh-20261010-2253.json`.
SHA256: `5e435df40286fffe4b758c55cc35f13421fec7b676a4a0c0fab7ee909e274ead`.
Recorded **22:54:02 UTC**; observed host time
`2026-10-10T18:54:02.1424868-04:00`. Initial evidence retained. No atomic collection
or Link-header claim. Root's complete validation, publication and Docker rebuild
evidence remain separate. No tests, PostgreSQL/Docker, Git, runtime or remote
mutations. Final assessment frozen.
