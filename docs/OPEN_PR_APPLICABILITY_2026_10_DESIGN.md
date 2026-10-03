# Open PR applicability assessment design

Recorded October 3, 2026. This document explains selection eligibility and the
assessment boundary. Exact observations belong in the separate
[outcome](OPEN_PR_APPLICABILITY_2026_10_OUTCOME.md).

## Objective and prior work

Determine whether the current open PR collection contains an applicable change
that has not already been locally replayed. Select randomly only from a nonempty
eligible set. An open PR number alone does not justify repeating completed work:
compare its full immutable head and changed-file scope with the prior records.
A materially changed head must be assessed again rather than excluded by number.

The assessment follows local main
`af7336013e58ebd3524e2e08c11b6009380335bc`. Prior local replay records are:

| PR | Previously replayed scope | Prior result |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | Release workflow metadata-action reference | [PR 23 outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | Release workflow build-push-action reference | [PR 24 outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Controlled-provider fixture image reference | [PR 40 outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Those outcomes contain the earlier runtime evidence and maintained-version
decisions. This assessment does not repeat or extend their acceptance claims.

## Discovery and eligibility method

Use GitHub MCP repository search for `Harmoniarr user:cloudbyday90`, then fetch the
resolved [repository URL](https://github.com/cloudbyday90/Harmoniarr). Repository
metadata identifies repository ID `1221894481` and the canonical
[API repository URL](https://api.github.com/repos/cloudbyday90/Harmoniarr). Resolve
the returned `pulls_url` template rather than constructing an assumed endpoint.
The resulting [open collection request](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
uses `state=open`, `per_page=100`, and `page=1`.

Retain the collection items, consultation time, repository metadata, and full
head identifiers. Describe observed pagination precisely: distinguish a short
first-page response from an independently traversed collection or an observed
`Link` header. Follow an available next-page link, or request another page if a
full page leaves coverage unresolved.

Compare each returned head with its prior replay design and outcome. Confirm
changed filenames through `github_list_pr_changed_filenames`. Exclude an
unchanged replayed head and file scope. For a materially changed head or a new
candidate, retain fresh metadata, changed filenames, and the complete immutable
patch before judging applicability. Assess the patch against maintained behavior;
an old dependency reference must not replace a newer maintained version merely
because its PR remains open.

If applicable unreplayed candidates remain, use a cryptographic draw over that
eligible set, record its method/result, and propose a bounded local implementation
with a control comparison. An empty set requires neither a draw nor a fabricated
candidate.

## Decision rationale and controls

| Option | Consequence | Decision |
| --- | --- | --- |
| Exclude unchanged, previously replayed scopes | Preserve completed evidence and maintained versions | Adopt |
| Reimplement an unchanged historical PR | Repeat completed work without a new change to assess | Reject |
| Install a superseded historical reference | Downgrade maintained behavior | Reject |
| Reassess a materially changed head | Recognize new scope before selection | Required if observed |

The current assessment uses read-only MCP requests and local record comparisons.
Ignored research artifacts stay under
`.tmp/library-add-recovery-2026-10/pr-applicability/`. The resulting design and
outcome are documentation; they are not an application change or a runtime replay.
No merge, branch creation, release, workflow dispatch, registry publication, or
remote comment is part of this assessment.

Success means a traceable eligible-set decision with exact identity comparisons
and honest coverage limits. Later PR state can change, so a future round needs a
fresh collection and identity check.
