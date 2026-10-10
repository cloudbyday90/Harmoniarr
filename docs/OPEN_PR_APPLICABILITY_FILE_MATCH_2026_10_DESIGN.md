# Open PR applicability for file-match persistence

Assessment designed October 9 local / October 10 UTC, 2026, for the parent-supplied
main baseline `95cae70`. This read-only assessment supports the user's request
to implement a random applicable open PR locally. The separate
[outcome](OPEN_PR_APPLICABILITY_FILE_MATCH_2026_10_OUTCOME.md) records the observed
collection and comparisons; [research](FILE_MATCH_RESEARCH_2026_10.md) covers the
file-match transaction design.

Discover the repository through GitHub MCP search, then use the returned
repository metadata and `pulls_url` template. Read `state=open` with
`per_page=100`, advancing until an explicit empty terminal page. Fetch each
returned PR's exact metadata and its complete changed-filename list using the
MCP paginated filename helper. Re-read the collection and exact heads/bases
before concluding. This is a timestamped paginated observation, not an atomic
GitHub snapshot or a claim derived from an unavailable Link header.

Compare immutable head/base pairs and changed-file scopes with the earlier
PR 23, 24 and 40 local replay designs/outcomes and their recorded pairs in
the preceding [tag-snapshot assessment](OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_OUTCOME.md).
Exclude an unchanged already replayed scope; a PR number alone is insufficient
reason for exclusion. A changed pair or new scope needs fresh applicability
and risk assessment.

If unreplayed applicable candidates exist, retain the exact eligible set and
immutable patch evidence before selecting uniformly with a recorded
cryptographic seed/draw and rejection sampling. Report the selected patch and
test/implementation scope to the root before any application. If the set is
empty, selection is N/A; do not repeat replayed work, downgrade newer behavior,
merge, release or mutate remote services. No branch or source/test/Git change is
authorized for this assessment.

Retain raw MCP responses, query timestamps, source records and SHA256 hashes
under `.tmp/file-match-2026-10/`. The root owns implementation, baseline
verification and validation; this assessment adds no runtime test claim.
