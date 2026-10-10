# Tag snapshot open-PR applicability design

Planned 9 October 2026 local / 10 October UTC. Root reports clean main cab4e73.
This is separate from [tag research](TAG_SNAPSHOT_RESEARCH_2026_10.md).

Discover the repository through GitHub MCP search/full metadata. Expand the
returned pulls template and request open pages with per_page=100 through the
explicit empty boundary. Fetch immutable heads/bases and complete paginated
filenames, then recheck collection and individual metadata.

Compare exact scope with recorded
[PR23](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md),
[PR24](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) and
[PR40](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) local replays.
Exclude unchanged replayed patches; changed heads need fresh assessment rather
than exclusion by PR number.

If eligible scope exists, retain the immutable patch and an unbiased reproducible
random draw, then report selection/risk to root. This assessment never applies
or merges it. Empty eligibility has no draw, duplicate replay, downgrade,
application or merge.

Retain actual discovery/pages/metadata/files/comparisons under ignored
.tmp/tag-snapshot-2026-10/, with hashes in the separate
[outcome](OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_OUTCOME.md).
Link headers are not exposed by MCP. Explicit empty-page evidence establishes
the observed boundary; reads are non-atomic and future changes need a new
assessment. No runtime or external mutation is authorized here.
