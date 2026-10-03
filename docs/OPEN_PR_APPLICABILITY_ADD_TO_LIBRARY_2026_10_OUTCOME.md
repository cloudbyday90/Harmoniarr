# Open PR applicability for Add to library: outcome

Recorded October 3, 2026. No applicable unreplayed candidate was found in the
fresh observed collection. The separate
[design](OPEN_PR_APPLICABILITY_ADD_TO_LIBRARY_2026_10_DESIGN.md) defines eligibility
and selection controls.

## Fresh discovery and pagination

GitHub MCP repository search resolved `cloudbyday90/Harmoniarr`, repository ID
`1221894481`, and its canonical
[repository URL](https://github.com/cloudbyday90/Harmoniarr).
Fresh metadata returned the
[API repository URL](https://api.github.com/repos/cloudbyday90/Harmoniarr) and
`pulls_url` template
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.
Collection URLs below were resolved from that metadata.

| Request | Consultation time, UTC | Observed result |
| --- | --- | --- |
| [Open collection, page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | October 3, 2026, 19:55:38 | Three open, non-draft items, ordered `[40, 24, 23]` |
| [Open collection, page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | October 3, 2026, 19:55:48 | Empty array |

Both requests used `per_page=100`. The short first page and explicit empty
second page establish the observed pagination boundary for this consultation.
The connector did not expose HTTP `Link` headers. The pages and subsequent
changed-file checks were separate requests, not an atomic collection snapshot;
later GitHub state is outside this evidence.

Local HEAD was independently read as
`fddad7becf6e4fed3422752b7b512451905e1ea4`.

## Exact comparisons and disposition

Fresh changed-filename checks consulted at `2026-10-03 19:55:48 UTC` returned
the same file scope as each earlier replay record. Every full head and base also
matched its recorded identity.

| PR | Unchanged immutable head | Fresh changed filename | Earlier replay result |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | `.github/workflows/release-image.yml` | [PR 23 outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | `.github/workflows/release-image.yml` | [PR 24 outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | `compose.controlled-provider-fixture.yaml` | [PR 40 outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

PRs 23 and 24 retained base
`0b661a2a5a5e6318683ee980c3c5d02298987e9d`; PR 40 retained base
`4429a4d6146b16bde16ba01298d39a5d2494e0aa`.
These are observed PR metadata, not a new resolution of remote main.

The comparison used the earlier
[PR 23 design](RANDOM_PR_23_LOCAL_REPLAY_DESIGN.md),
[PR 24 design](RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md), and
[PR 40 design](RANDOM_PR_40_LOCAL_REPLAY_DESIGN.md). Their historical patch scopes
are metadata-action v6.1.0, build-push-action v7.2.0, and the fixture's
`node:26.7.0-alpine` reference, respectively. The linked outcomes already record
local replay and maintained successor decisions.

The eligible unreplayed set is `[]`. No seed/draw, candidate selection,
reimplementation, downgrade, or merge occurred. No complete PR patch was
re-fetched because immutable head/base identity and changed-file scope remained
unchanged. This is a fresh applicability assessment, not a new runtime replay.

## Retained evidence and limits

Evidence is retained under ignored
`.tmp/add-to-library-2026-10/pr-applicability/`. Hashes bind these local snapshot
files, not future GitHub state.

| Evidence filename | SHA-256 |
| --- | --- |
| `repository-discovery.json` | `98b7e3c9502068ef76c6a24cf5ba04b77708c885495ca0dbae4249c4239a84a6` |
| `open-pr-collection.json` | `ef4bebaa916c2504907f7df9bf502201267a1e3a9529fa9ecb65a08cae588b6f` |
| `changed-filenames.json` | `b28e5e87a891a1d3c3ab3174df4fc0ed59ccf4a0e9ecedd0727cc5f564e8da72` |
| `head-scope-comparison.json` | `5c8d4e934d08c560990f5a1ffaca9cad7562267f92197ddb575f78333728bc38` |

The records retain repository discovery/metadata, full collection items for both
pages, changed-filename tool responses, and explicit prior/fresh comparisons.
The file-list tool documents pagination across all changed-file pages; its
response exposes filenames, not HTTP headers.

This evidence establishes unchanged replay identity and the observed collection
boundary. It does not revalidate earlier runtime executions, current upstream
releases, application behavior, hosted runners, live providers, or published
artifacts. No application/test source or dependency reference changed, and no
tests or replay harnesses ran. This subtask authored only the two applicability
documents and ignored evidence; it performed no commit, push, branch, remote
comment, workflow dispatch, publication, release, or merge.
