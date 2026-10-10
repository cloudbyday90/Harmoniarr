# Open PR applicability outcome: shared PostgreSQL cohort adoption

Client date: October 10, 2026, America/New_York. Eligible unreplayed set:
**empty**. No draw, replay, application, downgrade, merge or remote write.

## Repository and collection

Fresh GitHub MCP search returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), repository
ID `1221894481`. Fetching its returned URL supplied actual metadata and the pulls
template `https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

Explicit [page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
at **19:59:25 UTC** returned three PRs; the
[terminal page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
at **19:59:26 UTC** returned zero. Full records and complete filenames were read
at 19:59:26 UTC. Final collection recheck at 19:59:51 UTC retained three/zero;
full metadata recheck at **19:59:52 UTC / 15:59:52 EDT** retained the same
open, non-draft immutable pairs.

## Exact immutable comparison

| PR | Head | Base | Complete filename scope | Prior local outcome |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Each full record reports one changed file, matching freshly fetched complete
filenames. Rechecks reuse those lists only for unchanged immutable pairs. Replay
records establish heads/scopes; the
[preceding launcher assessment](OPEN_PR_APPLICABILITY_TEST_LAUNCHER_2026_10_OUTCOME.md)
also records these bases. Every observed patch is already locally replayed.

## Evidence and limits

Raw discovery/metadata/pages/full records/complete filenames/rechecks/comparisons:
`.tmp/shared-postgres-cohort-adoption-2026-10/pr-applicability/open-pr-assessment.json`.
SHA256: `3df9b0f7ff68a04b864af99c48e88544e76082aa3bb714fad25f86592ff0f92b`.
Evidence record timestamp: **20:01:42 UTC**, with host observation
`2026-10-10T16:01:42.8915229-04:00`.

Explicit empty terminal pages bound these observations; no atomic GitHub snapshot,
Link-header, all-time absence or test claim. No runtime/tests/PostgreSQL/Docker/Git
or external changes. Parent validation is separately attributed. Assessment frozen.

## Final precommit refresh

October 10, America/New_York: fresh GitHub MCP repository search and returned
repository metadata at **20:48:37 UTC** confirmed the same canonical repository
and pulls template. [Open page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
at **20:48:45 UTC** returned three; the explicit
[terminal page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
at **20:48:46 UTC** returned zero. Full records for PR40/24/23 at
**20:48:46 UTC / 16:48:46 EDT** remained open, non-draft, with exactly the heads
and bases above and one changed file each. Complete initial filename lists were
reused only because those immutable pairs and counts were unchanged; current
local replay records still identify the same heads and scopes.

Eligible unreplayed set remains **empty**. No random draw or redundant replay.
Fresh raw discovery, pages, full records and comparisons:
`.tmp/shared-postgres-cohort-adoption-2026-10/pr-applicability/pr-precommit-refresh-20261010-2048.json`.
SHA256: `ddab8533cac400e4583bf9861c6775e6b4ace3740d58943c78c165972b5e8ec3`.
Recorded at **20:49:08 UTC**; observed host time
`2026-10-10T16:48:58.7708680-04:00`. Initial evidence is retained. These bounded
reads are not an atomic collection snapshot; root's executed validation remains
separate. No runtime/tests/PostgreSQL/Docker/Git or remote mutations. Frozen.
