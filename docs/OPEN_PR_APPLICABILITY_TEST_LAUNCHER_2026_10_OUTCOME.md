# Open PR applicability outcome: parent-owned PostgreSQL launcher

Client date: October 10, 2026, America/New_York. Eligible unreplayed set:
**empty**. No draw, replay, application, downgrade, merge or remote write.

## Repository and collection

Fresh GitHub MCP search returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), repository
ID `1221894481`. Fetching that returned URL supplied actual metadata and the pulls
template `https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

Explicit [open page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
at **18:59:46 UTC** returned three PRs, followed by zero on
[terminal page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2).
Full records and complete filenames were read at 18:59:46 UTC. Collection and
exact metadata rechecks at **19:00:52 UTC / 15:00:52 EDT** retained three/zero
and the same open, non-draft immutable pairs.

## Exact immutable comparison

| PR | Head | Base | Complete filename scope | Prior local outcome |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Every full record reports open/non-draft and changed_files=1, matching fresh
complete filenames. Rechecks reuse those scopes only for unchanged immutable
pairs. Replay records establish heads/scopes; the
[preceding template assessment](OPEN_PR_APPLICABILITY_TEST_TEMPLATES_2026_10_OUTCOME.md)
also records these bases. All observed patches have already been locally replayed.

## Evidence and limits

Fresh discovery/metadata/pages/full records/complete files/rechecks/comparisons:
`.tmp/postgres-test-launcher-2026-10/pr-applicability/open-pr-assessment.json`.
SHA256: `fd297056a7917b550d113c288f6b4865fbda0ca3d724029dfe4ccd7fe9b9d7e4`.
Evidence record timestamp: **19:05:38 UTC**, with host observation
`2026-10-10T15:05:39.2719780-04:00`.

Explicit empty terminal pages bound the observations; no atomic GitHub snapshot,
Link-header, all-time absence or runtime-test claim. No runtime/tests,
PostgreSQL/Docker/Git or external changes. Assessment frozen after this recheck.

## Final precommit refresh

Fresh GitHub MCP search and returned repository metadata at **19:46:02 UTC**
on October 10 again resolve repository `1221894481` and its actual pulls template.
Explicit open pages at **19:46:02–19:46:03 UTC** returned three then terminal zero.
Full records at **19:46:03 UTC / 15:46:03 EDT** confirm PR23/24/40 remain
open and non-draft with the exact head/base pairs above and one changed file each.
Complete initial filenames are reused only for those unchanged immutable pairs.

Eligible unreplayed set: **empty**. No draw, replay, application, downgrade,
merge or remote write. Fresh search/metadata/pages/full records/comparisons:
`.tmp/postgres-test-launcher-2026-10/pr-applicability/pr-precommit-refresh-20261010-1946.json`.
SHA256: `9da75080e2ffa4a88693c6f79c2a506ee9e72f584f8d92be430916fb881f37da`.
Evidence record timestamp: **19:46:29 UTC**, with host observation
`2026-10-10T15:46:29.8159378-04:00`. Initial evidence remains intact.

This bounded observation is separate from parent validation and makes no atomic
snapshot or Link-header claim. No runtime/test/PostgreSQL/Git mutation;
assessment frozen after this requested refresh.
