# Batch-handoff open-PR applicability design

Planned 8 October 2026, America/New_York; fresh MCP observations occurred
9 October UTC. Root-provided baseline: main at ac4993f. This assessment
does not implement a runtime patch or repeat an earlier replay.

## Selection contract

Discover the repository with GitHub MCP search, then use its returned canonical
URL and REST pull-collection template. Read open PRs with per_page=100 and
explicit page boundaries. Recheck immutable head/base identities and obtain
complete changed filenames through the paginated MCP filename tool.

Compare patch scope with the earlier [PR23 replay outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md),
[PR24 replay outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md), and
[PR40 replay outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md). Exclude an unchanged
replayed head and scope; a materially changed head must be assessed afresh.
A PR number alone is not an exclusion rule.

An eligible unreplayed patch must have a retained immutable head, complete scope,
and a feasible local implementation consistent with the user's boundaries.
If the eligible set is nonempty, retain a reproducible unbiased random draw,
then report the selected immutable patch and material risks before root applies it.
An empty set has no draw and no redundant replay, maintained downgrade, or merge.

## Rationale and boundaries

| Choice | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Repeat historical unchanged PRs | Reuses known fixtures | Adds no unreplayed implementation and may downgrade maintained dependencies | Exclude unchanged scope |
| Trust an old PR list | Fast | Can miss changed heads or newly opened work | Fresh collection and final recheck |
| Assess only eligible new scope before drawing | Preserves meaningful random selection | Requires bounded metadata and filename evidence | Adopt |

No branch, release, commit, push, PR merge, remote comment, provider mutation,
application source change, or test execution belongs to this assessment.
Provider batch research has its own [ledger](SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md).

## Evidence plan

Retain discovery, both collection pages, final page/head recheck, per-PR metadata,
complete filenames, and the comparison under ignored
.tmp/batch-handoff-2026-10/pr-applicability/. Hash the retained JSON.
Record exact observed results and UTC times in the separate
[outcome](OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_OUTCOME.md).

A short first page plus an explicitly empty second page is the observed boundary.
The MCP response does not expose HTTP Link headers; do not claim Link verification
or an atomic, permanent inventory of all future open work.
