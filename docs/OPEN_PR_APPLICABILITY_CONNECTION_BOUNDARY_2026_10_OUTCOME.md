# Open PR applicability: connection boundary work

Date: 2026-10-13. GitHub MCP repository metadata, open pulls pages 1/2,
all three changed-file lists and the selected PR's exact patch were refreshed.
Page two was empty. Node crypto.randomInt selected #40 uniformly from the three
open PRs. Applicable unreplayed patches: zero.

| Open PR | Immutable head | Current applicability |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | One controlled-provider Compose image change from Node 24.19 to 26.7; current main uses 24.21 and declares Node 24 support. Already locally evaluated; not a connection-diagnostic patch |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Release workflow action 7.2; current immutable pin is 7.4; already locally replayed |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Release metadata action 6.1; current immutable pin is 6.2; already locally replayed |

The unchanged heads and filenames match the previous
[#40](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md),
[#24](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) and
[#23](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) evaluation documents. Prior executions
are historical evidence, not newly run tests. This round does not duplicate
replays, move to Node 26, downgrade workflow pins, merge a PR or create a release.

Recommendation: take a new applicable patch when one exists; keep this main-only
commit focused on the diagnosed evidence gap and missing workload measurements.
