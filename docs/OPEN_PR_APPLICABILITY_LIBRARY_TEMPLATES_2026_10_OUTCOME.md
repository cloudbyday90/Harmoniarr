# Open PR applicability outcome: library test schema templates

October 10, 2026, America/New_York. Eligible unreplayed set: **empty**.
No random draw, application, redundant replay, downgrade, merge or remote write.

## Discovered repository and observed collection

Fresh GitHub MCP repository search returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), ID
`1221894481`. Fetching that returned URL supplied the actual repository metadata
and pulls template `https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

Explicit [open page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
at **21:04:28 UTC** returned three; [terminal page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
at **21:04:28 UTC** returned zero. Full records and freshly complete filename lists
were read at **21:04:29 UTC**. Post-filename full metadata rechecks at
**21:05:01 UTC / 17:05:01 EDT** retained the same open, non-draft pairs and counts.

## Exact immutable comparison

| PR | Head | Base | Complete file scope | Prior local outcome |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Each full record reports exactly one changed file, matching its complete list.
All pairs/scopes are unchanged from the current replay records and
[preceding cohort assessment](OPEN_PR_APPLICABILITY_COHORT_ADOPTION_2026_10_OUTCOME.md).
The post-filename metadata recheck establishes no observed head/base drift during
scope collection. Every observed patch is already locally implemented.

## Evidence and limits

Fresh raw search/metadata/pages/full records/complete scopes/rechecks/comparisons:
`.tmp/library-test-schema-templates-2026-10/pr-applicability/open-pr-assessment.json`.
SHA256: `b2b8c9a5387574fffd397ef0b48431f2e28d646696c98dc6ea46e71484fcfbce`.
Recorded **21:05:33 UTC**; host observation
`2026-10-10T17:05:02.1627186-04:00`.

Explicit empty terminal pagination bounds this observation; no atomic snapshot,
Link-header or all-time absence claim. No app/runtime/tests/PostgreSQL/Docker/Git
or external mutations. Root's design, implementation and validation remain
separately attributed. Assessment frozen.

## Final precommit refresh

October 10, America/New_York. Fresh GitHub MCP repository discovery began at
**21:39:10 UTC**; search and returned metadata confirmed the same canonical
repository and pulls template. [Open page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
at **21:39:11 UTC** returned three; [terminal page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
at **21:39:12 UTC** returned zero. Full PR40/24/23 records at
**21:39:12 UTC / 17:39:12 EDT** remained open, non-draft, with exactly the heads
and bases above and one changed file each. Complete initial filename lists were
reused only for those unchanged immutable pairs/counts; replay records still
identify the same heads/scopes. Eligible set remains **empty**; no draw or replay.

Fresh raw discovery/pages/full records/comparisons:
`.tmp/library-test-schema-templates-2026-10/pr-applicability/pr-precommit-refresh-20261010-2139.json`.
SHA256: `903bdfb168bfe28def2bdbcf7d74923067ef173ebd444947cd693f0bba51dec2`.
Recorded **21:39:29 UTC**; host observation
`2026-10-10T17:39:28.8759667-04:00`. Initial evidence retained; no atomic GitHub
snapshot or Link-header claim. Root's validation is separate. No tests,
PostgreSQL/Docker, Git, runtime or remote mutations. Final assessment frozen.
