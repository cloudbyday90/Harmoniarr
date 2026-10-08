# Open PR applicability for automatic library add: outcome

Recorded October 8, 2026. No applicable unreplayed candidate was found in the
fresh observed collection. The separate
[design](OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_DESIGN.md) defines eligibility
and selection controls.

## Fresh discovery and pagination

GitHub MCP repository search resolved `cloudbyday90/Harmoniarr`, repository ID
`1221894481`, and its canonical
[repository URL](https://github.com/cloudbyday90/Harmoniarr). Fresh normalized
metadata and a raw repository GET returned the
[API URL](https://api.github.com/repos/cloudbyday90/Harmoniarr) and
`pulls_url` template
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.
Collection URLs below were resolved from that returned template.

| Request | Consultation time, UTC | Observed result |
| --- | --- | --- |
| [Open collection, page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | October 8, 2026, 10:44:58 | Three open, non-draft items, response order `[40, 24, 23]` |
| [Open collection, page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | October 8, 2026, 10:45:05 | Empty array |

Both requests used `per_page=100`. The short first page and explicit empty
second page corroborate the observed pagination boundary. The connector exposed
no HTTP `Link` headers. These pages, filename requests, and metadata rechecks
were separate requests, not an atomic snapshot; later GitHub state is outside
this assessment.

Local HEAD was independently read as
`04fdbce692db2b90e65d6c5397513f943892e710`.

## Exact comparison and disposition

Fresh changed-filename requests at `2026-10-08 10:45:05 UTC` returned the
same paths as each earlier replay. Subsequent PR metadata reads at
`2026-10-08 10:45:16 UTC` corroborated every collection head/base and open,
non-draft status. Every full immutable head, base, and changed-file scope was
unchanged.

| PR | Unchanged immutable head | Fresh changed filename | Prior replay outcome |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | `.github/workflows/release-image.yml` | [PR 23](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | `.github/workflows/release-image.yml` | [PR 24](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | `compose.controlled-provider-fixture.yaml` | [PR 40](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

PRs 23 and 24 retained base
`0b661a2a5a5e6318683ee980c3c5d02298987e9d`; PR 40 retained base
`4429a4d6146b16bde16ba01298d39a5d2494e0aa`.
These are PR metadata identities, not a new resolution of remote main.

The earlier replay outcomes bind the exact historical metadata-action v6.1.0,
build-push-action v7.2.0, and fixture `node:26.7.0-alpine` scopes. Their linked
designs record the patch paths and implementation plans. The retained October 3
comparison under `.tmp/add-to-library-2026-10/pr-applicability/` corroborates
historical bases; its
[applicability outcome](OPEN_PR_APPLICABILITY_ADD_TO_LIBRARY_2026_10_OUTCOME.md)
documents that earlier comparison separately.

The eligible unreplayed set is `[]`. No seed/draw, selection, reimplementation,
downgrade, or merge occurred. No complete patch was fetched again because full
head/base identities and changed paths remained unchanged. This is a fresh
applicability assessment, not a new runtime replay or a latest-dependency review.

## Retained evidence and limits

Evidence is retained under ignored
`.tmp/automatic-library-add-2026-10/pr-applicability/`.
Hashes bind the local retained files, not future GitHub state.

| Evidence filename | SHA-256 |
| --- | --- |
| `repository-discovery.json` | `ac34b39596035fa996962fc34b4bae4addfcfdeee6943ecbdbcf0a5f0f7603a8` |
| `open-pr-collection.json` | `e84a4d40b21ae0dd2d0899b7c772f66da4d1d3345f42af5a1eb83f8fd9561801` |
| `changed-filenames.json` | `c69600e6a1bf6d2a2a402aef1d4d368ebfacbf91affbb0e6a1bcbd74d5076275` |
| `head-scope-comparison.json` | `f896626eb536b650de3c3dffa5466a26231bcf86d22d98b0486a233ef9b0a161` |

Records retain repository search/metadata, full collection responses for both
pages, filename responses and subsequent per-PR metadata, and explicit
prior/fresh comparisons. The filename tool documents all file-list pages;
its response exposes filenames, not HTTP headers. JSON parsing and ignored-path
checks succeeded.

This evidence establishes unchanged replay identities and the observed
collection boundary. It does not revalidate earlier runtime execution, current
upstream versions, application behavior, hosted runners, live providers, or
published artifacts. This subtask authored only these two documents and ignored
evidence. No source/test changes, tests, replay harnesses, branch, commit, push,
remote comment, workflow dispatch, publication, release, tag, or merge occurred.
