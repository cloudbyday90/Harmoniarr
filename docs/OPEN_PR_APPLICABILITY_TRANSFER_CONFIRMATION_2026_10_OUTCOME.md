# Open PR applicability for transfer confirmation: outcome

Recorded October 8, 2026 (America/New_York). The fresh eligible unreplayed set
is empty. The [design](OPEN_PR_APPLICABILITY_TRANSFER_CONFIRMATION_2026_10_DESIGN.md)
defines eligibility and the conditional random selection procedure.

## Discovered repository and fresh collection

GitHub MCP repository search resolved `cloudbyday90/Harmoniarr`, repository ID
`1221894481`, and its canonical
[repository](https://github.com/cloudbyday90/Harmoniarr). Repository metadata
consulted at `2026-10-09 01:41:10 UTC` returned
[the API resource](https://api.github.com/repos/cloudbyday90/Harmoniarr) and
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.
The following collection requests were derived from that returned template.
These UTC consultations occurred on October 8 in the workspace's Eastern time zone.

| Read | Consultation, UTC | Result |
| --- | --- | --- |
| [Initial page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | October 9, 01:41:25 | Three open, non-draft PRs, response order `[40, 24, 23]` |
| [Initial page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | October 9, 01:41:26 | Empty array |
| [Final page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | October 9, 01:42:37 | Same three PRs and heads/bases |
| [Final page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | October 9, 01:42:37 | Empty array |

Each request used `per_page=100`. The short first pages and explicit empty
second pages corroborate the observed boundary. No HTTP Link headers were
exposed. This is a bounded collection observation, not a guarantee about future
PRs or an atomic snapshot across requests.

The parent supplied baseline `33ad042`, main. No Git command independently
resolved or verified the local baseline.

## Immutable comparisons and disposition

Fresh filename reads and subsequent per-PR metadata at
`2026-10-09 01:41:36 UTC` corroborated the collection identities. Each PR
reported one changed file; the filename tool covers all file-list pages.
The final collection recheck also retained the same immutable identities.

| PR | Unchanged head | Unchanged changed-file scope | Prior replay |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | `.github/workflows/release-image.yml` | [Outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | `.github/workflows/release-image.yml` | [Outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | `compose.controlled-provider-fixture.yaml` | [Outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

PRs 23 and 24 retain base `0b661a2a5a5e6318683ee980c3c5d02298987e9d`;
PR 40 retains base `4429a4d6146b16bde16ba01298d39a5d2494e0aa`.
These patch scopes respectively bind the earlier metadata-action v6.1.0,
build-push-action v7.2.0 and fixture Node 26.7.0 local replays. The previous
recovery applicability record is historical; fresh reads above establish this
round's remote evidence.

Eligible set: `[]`. No seed, draw, selected patch, reimplementation, downgrade
or merge was produced. Full patches were not fetched again because complete
head/base identities and changed-file scopes remained unchanged. This round
is an applicability assessment, not a new runtime replay or a dependency review.

## Retained evidence and limits

PR evidence files are retained under ignored
`.tmp/transfer-confirmation-2026-10/pr-applicability/`.

| Filename | SHA-256 |
| --- | --- |
| `repository-discovery.json` | `266066c9cb4f0909a7b3a2a86fe2245ad60e2d82a2ece8075fa1ce6b62c62bf3` |
| `open-pr-collection.json` | `64dbdbf8bfdff0cb12426c722ada13f7e1da011cfe6b2250f9997ba9f4892520` |
| `changed-filenames.json` | `b2ce6345f8a93c6811eef12cdc8bf030589adafa521e8abc824736e85fb6f2eb` |
| `head-scope-comparison.json` | `576bcb9a2cbe9ca0016b8beef8dfd2ce90c38140d5e37465d90aec3d6e04c349` |

Hashes bind the retained local responses, not later remote state. The records
include full initial/final pages, complete file-list responses and per-PR
metadata rechecks. Documentation links and JSON syntax were checked.

This PR subtask inspected prior documentation only. It changed these two
documents and ignored evidence, ran no tests or replay harnesses, and made no
Git or remote mutation. It does not revalidate previous executions, application
behavior, live providers, hosted runners or published artifacts. Official slskd
research is a separate read-only task and is not PR replay evidence.
