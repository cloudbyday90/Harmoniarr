# Open PR applicability: operator track consent

October 12, 2026, America/New_York. Follow the
[existing selection design](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_DESIGN.md).
GitHub MCP repository search identified `cloudbyday90/Harmoniarr`, default main;
fetched metadata supplied the pulls collection template. Initial page 1 returned
three full open records, with an empty terminal page 2. Complete changed-file
inventories were read through MCP for all three.

| Open non-draft PR | Immutable head / base | Complete scope | Prior local replay |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` / `0b661a2a5a5e6318683ee980c3c5d02298987e9d` | `.github/workflows/release-image.yml` | [Outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` / `0b661a2a5a5e6318683ee980c3c5d02298987e9d` | `.github/workflows/release-image.yml` | [Outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` / `4429a4d6146b16bde16ba01298d39a5d2494e0aa` | `compose.controlled-provider-fixture.yaml` | [Outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

The eligible unreplayed set is empty. No random draw, duplicate replay,
dependency downgrade or PR merge is justified. The final two-page refresh
returned the same open non-draft head/base pairs and an empty terminal page
before publication; paginated reads are not an atomic
or future absence guarantee. Work remains on main, with no release or tag.
