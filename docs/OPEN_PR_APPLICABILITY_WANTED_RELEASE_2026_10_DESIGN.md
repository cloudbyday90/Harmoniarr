# Open PR applicability design: wanted-release reconciliation

Client date: **October 10, 2026, America/New_York**. Parent-supplied clean main
baseline: `96d1f56`. This read-only assessment supports the user's request to
apply a random applicable open PR locally. The [outcome](OPEN_PR_APPLICABILITY_WANTED_RELEASE_2026_10_OUTCOME.md)
records observations; [research](WANTED_RELEASE_RECONCILIATION_RESEARCH_2026_10.md)
records the wanted-publication contract and primary-source evidence.

Discover the actual repository through GitHub MCP search, fetch its returned URL
and use the returned pulls template. Read open collections with per_page=100
until an explicit empty terminal page. Fetch each PR's exact metadata and complete
changed-filename list. Re-read collection and immutable head/base/state metadata
before concluding. Record actual UTC/local observation separately from the client
task date, without inventing Link-header or atomic snapshot evidence.

Compare immutable pairs and scopes with earlier PR23/24/40 local replay
designs/outcomes and the recorded bases in the preceding
[release-reconciliation assessment](OPEN_PR_APPLICABILITY_RELEASE_RECONCILIATION_2026_10_OUTCOME.md).
Exclude unchanged already replayed scope, not a PR number by itself. A changed
pair or new file scope needs fresh applicability/risk assessment.

If eligible unreplayed candidates exist, retain the exact set and immutable patch
evidence, then draw uniformly with a retained cryptographic seed and rejection
sampling. Report the selected patch/scope before root implementation. An empty
set means draw/replay is N/A: no redundant replay, downgrade or merge.

Only the separate docs and ignored evidence are writable here. No runtime/test,
Git, branch, release, merge or external service mutation is authorized. Root
baseline verification and executed validation remain separate.
