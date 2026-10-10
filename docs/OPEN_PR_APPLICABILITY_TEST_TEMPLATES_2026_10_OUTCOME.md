# Open PR applicability outcome: PostgreSQL test templates

Client date: October 10, 2026, America/New_York. Eligible unreplayed set:
**empty**. No random draw, replay, application, downgrade, merge or remote write.

## Repository and fresh collection

GitHub MCP search returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), repository
ID `1221894481`. Fetching its returned URL supplied actual metadata and the pulls
template `https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

Explicit [page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
returned three PRs at **17:10:19 UTC**;
[terminal page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
returned zero at **17:10:20 UTC**. Full records and complete filenames were read
at 17:10:20 UTC. Collection and full metadata rechecks at
**17:12:40 UTC / 13:12:40 EDT** retained pages three/zero and the same open,
non-draft immutable pairs.

## Exact comparison

| PR | Head | Base | Complete filename scope | Prior local outcome |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Each full record reports open/non-draft with changed_files=1, matching the freshly
fetched complete filename list. Rechecks reuse those fresh lists only for unchanged
immutable pairs. Earlier replay records establish heads/scopes; the preceding
[fixture assessment](OPEN_PR_APPLICABILITY_TEST_FIXTURES_2026_10_OUTCOME.md) also
records the bases. Every observed scope has already been replayed locally.

## Evidence and limits

Raw discovery/metadata/pages/full records/complete filenames/rechecks/comparisons:
`.tmp/postgres-test-templates-2026-10/pr-applicability/open-pr-assessment.json`.
SHA256: `e469a513a7fbc6ffe17261fcdf1dd65aafac73259213b72a8c0397821431fa76`.
Evidence record timestamp: **17:13:04 UTC**, with host observation
`2026-10-10T13:13:05.0059546-04:00`.

An explicit empty terminal page bounds these observations. No atomic GitHub
snapshot, Link-header, all-time absence or runtime-test claim is made. No runtime,
tests, PostgreSQL/Docker or Git changes; parent validation remains separately
attributed. Assessment is frozen after this bounded recheck.

## Final precommit refresh

Fresh GitHub MCP search and returned repository metadata on October 10 again
resolved repository `1221894481` and its actual pulls template at **17:54:42 UTC**.
Explicit open pages at **17:54:43 UTC** returned three PRs and then terminal zero.
Full PR records at **17:54:43 UTC / 13:54:43 EDT** confirm PR23/24/40 remain
open, non-draft and at the exact head/base pairs above, with one changed file each.
Complete initial filenames are reused only for those unchanged immutable pairs.

Eligible unreplayed set: **empty**. No draw, replay, local application, downgrade,
merge or remote write. Fresh search/metadata/pages/full records/comparisons:
`.tmp/postgres-test-templates-2026-10/pr-applicability/pr-precommit-refresh-20261010-1754.json`.
SHA256: `35efc261d87a49724d8bd4b9f4df32ef31077b410cae5b71b6efd8f20291accf`.
Evidence record timestamp: **17:55:06 UTC**, with host observation
`2026-10-10T13:55:06.7804858-04:00`. Initial records remain intact.

This bounded observation is separate from parent validation and makes no atomic
snapshot or Link-header claim. No runtime/test/PostgreSQL/Git mutation; assessment
is frozen after this requested refresh.
