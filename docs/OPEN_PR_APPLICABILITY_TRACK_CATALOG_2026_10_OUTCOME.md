# Open PR applicability: verified track requirements

October 12, 2026, America/New_York. Follow the
[existing selection design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).
GitHub MCP search identified `cloudbyday90/Harmoniarr` and fetched metadata
provided its pulls template. Initial and final collection reads returned three
full open non-draft records on page 1 and an empty terminal page 2. Complete
changed-file inventories were read through MCP for each.

| PR | Immutable head / base | Complete scope | Prior local replay |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` / `0b661a2a5a5e6318683ee980c3c5d02298987e9d` | `.github/workflows/release-image.yml` | [Outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` / `0b661a2a5a5e6318683ee980c3c5d02298987e9d` | `.github/workflows/release-image.yml` | [Outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` / `4429a4d6146b16bde16ba01298d39a5d2494e0aa` | `compose.controlled-provider-fixture.yaml` | [Outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

All head/base pairs remain previously replayed locally. The eligible unreplayed
set is empty; no random draw, duplicate implementation, dependency downgrade or
PR merge is justified. Paginated observations are not an atomic or future absence
guarantee. Publication stays main only, with no release or tag.
