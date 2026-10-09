# Open PR applicability for fallback recovery: outcome

Recorded October 8, 2026. No applicable unreplayed candidate was found in this
fresh collection. The separate
[design](OPEN_PR_APPLICABILITY_RECOVERY_2026_10_DESIGN.md) defines eligibility
and selection controls.

## Fresh discovery and pagination

Fresh GitHub MCP search resolved `cloudbyday90/Harmoniarr`, ID `1221894481`,
and its canonical [repository URL](https://github.com/cloudbyday90/Harmoniarr).
Normalized/raw metadata consulted at `2026-10-08 22:01:37 UTC` returned the
[API URL](https://api.github.com/repos/cloudbyday90/Harmoniarr) and
`pulls_url` template
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.
The collection URLs below were resolved from that returned template.

| Request | Consultation time, UTC | Observed result |
| --- | --- | --- |
| [Open collection, page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | October 8, 2026, 22:01:46 | Three open, non-draft items; response order `[40, 24, 23]` |
| [Open collection, page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | October 8, 2026, 22:01:53 | Empty array |

Both requests used `per_page=100`. The short first page and explicit empty
second page corroborate the observed pagination boundary. No HTTP `Link`
headers were exposed. Collection pages, filenames, and metadata rechecks were
separate requests, not an atomic snapshot; later GitHub state is outside this record.

The parent provided local baseline `d405771`, main. No Git command was run
to resolve or independently verify that local baseline.

## Exact identities and disposition

Fresh filename requests at `2026-10-08 22:01:53 UTC` matched prior replay
paths. Subsequent per-PR metadata at `2026-10-08 22:01:58 UTC` corroborated
every collection head/base and open, non-draft status; each reported one changed
file. All immutable heads, bases, and file scopes were unchanged.

| PR | Unchanged immutable head | Fresh changed filename | Prior replay outcome |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | `.github/workflows/release-image.yml` | [PR 23](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | `.github/workflows/release-image.yml` | [PR 24](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | `compose.controlled-provider-fixture.yaml` | [PR 40](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

PRs 23 and 24 retained base
`0b661a2a5a5e6318683ee980c3c5d02298987e9d`; PR 40 retained base
`4429a4d6146b16bde16ba01298d39a5d2494e0aa`.
These are observed PR identities, not a fresh resolution of remote main.

The replay outcomes bind metadata-action v6.1.0, build-push-action v7.2.0,
and fixture `node:26.7.0-alpine` scopes. Their designs record exact patch
paths and plans. Comparison also used the retained morning October 8 artifact
`.tmp/automatic-library-add-2026-10/pr-applicability/head-scope-comparison.json`;
its [outcome](OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_OUTCOME.md) records
that earlier consultation separately. Fresh requests above replace its remote
snapshot for this recovery assessment.

The eligible unreplayed set is `[]`. No seed/draw, selection, reimplementation,
downgrade, or merge occurred. No complete patch was fetched again because full
head/base identities and changed paths remained unchanged. This is an
applicability assessment, not a new runtime replay or latest-dependency review.

## Retained evidence and limits

Four JSON records are retained under ignored
`.tmp/fallback-recovery-2026-10/pr-applicability/`. Their hashes bind these
local files, not future remote state.

| Evidence filename | SHA-256 |
| --- | --- |
| `changed-filenames.json` | `e132ec53f90a766a591e47e3c915d39778e63064cf07b9d777a5000283d12277` |
| `head-scope-comparison.json` | `c89003ed56ee77e9365e00bfa65862bec273e1407a59fc00485630f9cb923832` |
| `open-pr-collection.json` | `2ff49999f48efb1208220e23b0eeb5bf2623a610cd8bd285cd5c9928cdfba026` |
| `repository-discovery.json` | `37c69ed2ef31862dd945d7e06ded5cf17d0139e01aad369dac5564385f36a662` |

Records contain fresh repository discovery/metadata, both complete collection
responses, filename responses with subsequent per-PR metadata, and explicit
prior/fresh comparisons. The filename tool documents all file-list pages;
responses expose filenames, not headers. All retained JSON parsed successfully;
documentation links and whitespace were checked.

This evidence establishes unchanged replay identity and the observed collection
boundary. It does not revalidate prior execution, latest upstream versions,
application behavior, hosted runners, live providers, or published artifacts.
This subtask authored only these two documents and ignored evidence. It inspected
no application/test source and ran no tests, replay harnesses, or Git commands.
No branch, commit, push, merge, remote comment, workflow dispatch, image
publication, tag, or release occurred.
