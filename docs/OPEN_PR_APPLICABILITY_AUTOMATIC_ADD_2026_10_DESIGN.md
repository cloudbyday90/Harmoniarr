# Open PR applicability for automatic library add: design

Recorded October 8, 2026, for the automatic library-add development slice on
local main `04fdbce692db2b90e65d6c5397513f943892e710`. Exact observations
and disposition belong in the separate
[outcome](OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_OUTCOME.md).

## Objective and eligibility

Refresh the open PR collection and determine whether any applicable patch scope
has not already been locally replayed. Earlier applicability assessments are
historical evidence; this round requires fresh repository discovery, explicit
collection pagination, immutable identity checks, and changed-file checks.

The prior replay outcomes cover:

| PR | Previously replayed patch scope | Prior evidence |
| --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | Release workflow metadata-action v6.1.0 reference | [Design](RANDOM_PR_23_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | Release workflow build-push-action v7.2.0 reference | [Design](RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Controlled-provider fixture `node:26.7.0-alpine` reference | [Design](RANDOM_PR_40_LOCAL_REPLAY_DESIGN.md), [outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Exclude unchanged replayed scopes, not PR numbers permanently. A new immutable
head or materially changed patch requires fresh applicability assessment.
Historical superseded references do not justify downgrading maintained successors.
The replay outcomes establish earlier execution; this assessment does not repeat
or revalidate those executions.

## Discovery and comparison method

Use GitHub MCP repository search for `Harmoniarr user:cloudbyday90`, then read
metadata for the returned [repository URL](https://github.com/cloudbyday90/Harmoniarr).
The normalized repository metadata and raw repository GET resolve repository ID
`1221894481`, the [API URL](https://api.github.com/repos/cloudbyday90/Harmoniarr),
and `pulls_url` template
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

Resolve that returned template to request
[open collection page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
with `state=open`, `per_page=100`, and explicit page number. Request
[page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
to corroborate the observed end boundary. Retain exact responses and exposed
pagination information; do not claim HTTP Link evidence when the connector
does not expose headers. Separate requests are not an atomic snapshot.

Compare full heads and bases with retained historical metadata, and compare
changed filenames through `github_list_pr_changed_filenames`, whose tool
contract covers all paginated file-list pages. Re-read each PR's metadata after
its filename request to corroborate collection identities. Prior replay outcomes
bind replayed heads/scopes; the retained October 3 applicability comparison also
records historical bases.

For a new or materially changed candidate, retain its metadata, complete patch,
changed paths, and immutable identities before deciding applicability to current
main. Do not execute a patch merely because it is open.

## Selection and scope controls

Report any eligible unreplayed set to the root before selection. The root's
selection should be uniform over a stable, ordered eligible set and retain its
cryptographic draw/seed, method, and selected immutable identity. Review a bounded
local implementation/control plan before any runtime changes.

An empty eligible set requires no seed, random draw, selected candidate,
reimplementation, downgrade, or merge. Record a fresh applicability outcome
and retain completed replay results in their original documents.

This assessment permits read-only GitHub MCP requests, ignored evidence under
`.tmp/automatic-library-add-2026-10/pr-applicability/`, and these two
applicability documents. It does not authorize source/test changes, tests,
replay execution, branches, commits, pushes, merges, remote comments, workflow
dispatch, publication, tags, or releases. Success is a traceable eligibility
decision with precise collection, identity, and evidence limits.
