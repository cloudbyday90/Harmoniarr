# Open PR applicability for fallback recovery: design

Recorded October 8, 2026, for the fallback-policy-recovery development slice.
Parent-provided local baseline: `d405771`, main. This subtask does not
independently read Git state. Exact fresh observations belong in the separate
[outcome](OPEN_PR_APPLICABILITY_RECOVERY_2026_10_OUTCOME.md).

## Objective and eligibility

Determine whether an applicable open PR patch remains unreplayed. Earlier
assessments are historical evidence; refresh repository discovery, explicit
collection pagination, immutable heads/bases, and changed paths for this round.

The completed replay records cover:

| PR | Replayed historical scope | Prior evidence |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | Release workflow metadata-action v6.1.0 reference | [Design](RANDOM_PR_23_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | Release workflow build-push-action v7.2.0 reference | [Design](RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Controlled-provider fixture `node:26.7.0-alpine` reference | [Design](RANDOM_PR_40_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Exclude unchanged replayed scopes, not these PR numbers permanently. A new head
or materially changed patch requires fresh applicability review. Superseded
historical references do not justify downgrading maintained successors.
The linked outcomes document earlier execution; this assessment does not repeat it.

## Discovery and comparison

Search GitHub MCP for `Harmoniarr user:cloudbyday90`. Read normalized and raw
metadata using the returned [repository URL](https://github.com/cloudbyday90/Harmoniarr).
Fresh metadata resolves ID `1221894481`, the
[API URL](https://api.github.com/repos/cloudbyday90/Harmoniarr), and
`pulls_url` template
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

Resolve that returned template to request
[open collection page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
with explicit `state=open`, `per_page=100`, and page number. Request
[page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
to corroborate the observed end boundary. Retain exact responses and exposed
pagination information; do not infer HTTP Link headers from a short page.
Separate requests are not an atomic snapshot.

Compare full heads, bases, and filenames with prior retained identities.
`github_list_pr_changed_filenames` documents coverage across all paginated
file-list pages. Re-read per-PR metadata after filename requests to corroborate
collection identities. Replay outcomes bind historical heads/scopes; retained
earlier applicability comparisons also record historical bases.

For a new or materially changed candidate, retain metadata, complete patch,
changed files, and immutable identities before deciding whether it applies.
An open PR alone does not establish a need for implementation.

## Selection and authorized scope

Report any eligible unreplayed set to the root before a random draw. The root
should select uniformly from a stable ordered set, retaining the cryptographic
draw/seed, method, and selected immutable identity. Review a bounded local
implementation/control plan before changing runtime behavior.

An empty eligible set needs no draw, seed, selection, repeated replay,
reimplementation, downgrade, or merge. Record fresh applicability evidence
and leave executed replay results in their original outcomes.

This subtask permits read-only GitHub MCP requests, these two documents, and
ignored evidence under `.tmp/fallback-recovery-2026-10/pr-applicability/`.
It does not authorize application/test source inspection or changes, tests,
Git commands, replay execution, branches, commits, pushes, merges, remote
comments, workflow dispatch, publication, tags, or releases. The independent
recovery architecture review is a later assignment.
