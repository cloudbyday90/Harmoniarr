# Pre-provider refusal open-PR applicability design

Planned 9 October 2026 local and UTC. Root supplied clean main 12b9c11;
this assessment does not verify that baseline with Git. It is separate from the
[pre-provider refusal research](PRE_PROVIDER_REFUSAL_RESEARCH_2026_10.md).

## Eligibility and selection

Discover the repository through GitHub MCP search and full metadata. Expand
the returned pull-collection template, request open PRs with per_page=100,
and explicitly request the next page to establish the observed boundary.
Read each PR's immutable head/base and the complete paginated filename scope;
recheck both the collection and individual heads before concluding.

Compare exact scope against the recorded
[PR23](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md),
[PR24](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md), and
[PR40](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) local replay outcomes.
Exclude unchanged previously replayed patches. A materially changed head is
assessed afresh; a PR number alone is not an exclusion.

For a nonempty eligible set, retain the immutable patch and use a reproducible
unbiased random draw, then report selection and risks before root applies it.
An empty set has no draw, repeated replay, downgrade, application or merge.

## Evidence limits

Retain raw search/metadata, initial/final pages, per-PR metadata, complete
filenames and comparison decisions under ignored .tmp/pre-provider-refusal-2026-10/.
Record SHA-256 hashes in the separate
[outcome](OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_OUTCOME.md).

HTTP Link headers are not exposed by these MCP responses. A short first page
and explicitly empty second page establish the observed boundary; separate
reads do not create an atomic or permanent inventory. This work authorizes no
runtime/test/Git/provider change or remote mutation.
