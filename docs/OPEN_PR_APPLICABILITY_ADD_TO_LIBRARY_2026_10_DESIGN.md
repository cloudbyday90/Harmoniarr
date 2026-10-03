# Open PR applicability for Add to library: design

Recorded October 3, 2026, for the Add to library development slice on local main
`fddad7becf6e4fed3422752b7b512451905e1ea4`. Exact observations and disposition
belong in the separate [outcome](OPEN_PR_APPLICABILITY_ADD_TO_LIBRARY_2026_10_OUTCOME.md).

## Objective and eligibility

Refresh the open PR collection and determine whether any applicable patch scope
has not already been locally replayed. The previous assessment is historical
evidence; this round requires fresh repository discovery, collection requests,
immutable identity checks, and changed-file checks.

The earlier replay records cover these scopes:

| PR | Previously replayed scope | Prior evidence |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | Release workflow metadata-action reference | [Design](RANDOM_PR_23_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | Release workflow build-push-action reference | [Design](RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Controlled-provider fixture image reference | [Design](RANDOM_PR_40_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Exclude unchanged replayed scopes, not PR numbers permanently. A new head or
changed patch scope requires fresh assessment. A superseded historical dependency
reference does not justify downgrading the maintained implementation.

## Discovery and comparison method

Use GitHub MCP repository search for `Harmoniarr user:cloudbyday90`, then fetch
the discovered [repository URL](https://github.com/cloudbyday90/Harmoniarr).
Its metadata resolves repository ID `1221894481`, the
[API repository URL](https://api.github.com/repos/cloudbyday90/Harmoniarr), and
`pulls_url` template
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

Resolve that returned template to fetch the
[open collection, page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
with `state=open` and `per_page=100`. Retain pagination evidence explicitly.
This round also requests
[page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
to corroborate the observed end of the collection. Record exposed headers
honestly; separate requests do not form an atomic snapshot.

Compare full immutable heads and bases against the replay records, and confirm
changed filenames with `github_list_pr_changed_filenames`, which documents
pagination across the file-list pages. For a new or materially changed candidate,
retain fresh metadata, complete patch, changed paths, and immutable identities
before deciding whether its scope applies to current main.

## Selection and control plan

For a nonempty eligible set, sort candidates by PR number and full head, retain
a cryptographically generated seed, and derive an unbiased index with rejection
sampling over fixed-width cryptographic draw bytes. Retain the seed, ordered
eligible set, draw bytes, rejected values, and selected immutable identity.
Report the selected scope and propose a bounded local implementation/control
comparison before changing runtime source.

An empty eligible set requires no seed or draw, selection, reimplementation,
or downgrade. Completed runtime replays remain in their original outcomes.

This assessment permits read-only GitHub requests, ignored evidence under
`.tmp/add-to-library-2026-10/pr-applicability/`, and these two applicability
documents. Application/test changes, replay execution, branches, merges,
releases, workflow dispatch, publication, and remote comments are outside this
assessment. Success is a traceable eligibility decision with precise snapshot
and pagination limits.
