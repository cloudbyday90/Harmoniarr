# Open PR applicability design: release reconciliation

Client task date: **October 10, 2026, America/New_York**. The parent supplied
clean-main baseline `29fa665`. This separate read-only assessment supports the
user's request to apply a random applicable open PR locally. The
[outcome](OPEN_PR_APPLICABILITY_RELEASE_RECONCILIATION_2026_10_OUTCOME.md)
records observations; [research](RELEASE_RECONCILIATION_RESEARCH_2026_10.md)
records the reconciliation evidence and bounded contract.

Discover the repository with GitHub MCP search, fetch its returned URL, and use
the returned `pulls_url` template. Read open PRs with `per_page=100`, advancing
until an explicit empty terminal page. Fetch exact metadata and complete
changed-filename lists for every observed PR. Re-read the collection and exact
head/base/state metadata before concluding. Record actual query UTC times
separately from the client-facing task date; do not infer Link headers or an
atomic snapshot from this paginated observation.

Compare head/base pairs and file scopes with PRs 23, 24 and 40's earlier local
replay designs/outcomes and the recorded pairs in the preceding
[file-match assessment](OPEN_PR_APPLICABILITY_FILE_MATCH_2026_10_OUTCOME.md).
Exclude only unchanged already replayed scope. A familiar PR number with changed
immutable scope requires fresh applicability and risk assessment.

If unreplayed applicable candidates exist, retain their immutable patch evidence
and exact eligible set, then select uniformly using a recorded cryptographic
draw with rejection sampling. Report the selected scope/risk to the root before
application. If the eligible set is empty, draw/replay is N/A; do not repeat old
scope or downgrade newer behavior. This agent performs no application, branch,
release, merge, Git mutation or remote write.

Retain raw MCP responses and hashes under
`.tmp/release-reconciliation-2026-10/`. This assessment does not replace root
baseline verification or establish runtime/test results.
