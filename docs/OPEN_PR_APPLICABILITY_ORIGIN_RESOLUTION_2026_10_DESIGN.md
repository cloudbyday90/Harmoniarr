# Origin-resolution open-PR applicability design

Planned 9 October 2026. Root-provided clean baseline: main e08e658.
This is a fresh applicability assessment, separate from the
[origin-resolution research](ORIGIN_RESOLUTION_RESEARCH_2026_10.md).

## Selection and rationale

Discover the actual repository through GitHub MCP search and full metadata.
Use its returned pull-collection template; request open pages with per_page=100
and explicit page2 boundary evidence. Fetch per-PR immutable head/base metadata
and the filename tool's complete paginated scope, then recheck the collection.

Compare each patch with the recorded exact
[PR23](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md),
[PR24](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md), and
[PR40](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) replay outcomes.
An unchanged head/base/file scope is already replayed. A changed immutable head
must be assessed afresh; PR number alone is not an exclusion.

If an eligible unreplayed patch exists, retain its immutable scope and a
reproducible unbiased random draw, then report the selected patch and risks
before root applies it. An empty eligible set has no draw, redundant replay,
downgrade or merge. Existing maintained versions must not be replaced merely
to repeat a historical dependency bump.

## Evidence boundaries

Retain raw repository discovery, initial/final pages, per-PR metadata, complete
filenames and comparisons under ignored .tmp/origin-resolution-2026-10/.
Hash those artifacts and record observations in the separate
[outcome](OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_OUTCOME.md).

MCP did not expose HTTP Link headers. A short page1 plus an explicitly empty
page2 establishes the observed boundary, not an atomic or permanent future
inventory. No source/test/Git/provider change or remote mutation is authorized
by this assessment.
