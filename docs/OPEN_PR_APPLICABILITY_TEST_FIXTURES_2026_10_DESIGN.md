# Open PR applicability design: test fixture observability

Client date: October 10, 2026, America/New_York. Parent-supplied clean main
baseline: `c6cca24`. This read-only assessment supports the user's request to
apply a random applicable open PR locally. The
[outcome](OPEN_PR_APPLICABILITY_TEST_FIXTURES_2026_10_OUTCOME.md) owns observations;
[research](TEST_FIXTURE_OBSERVABILITY_RESEARCH_2026_10.md) owns official fixture
reporting, lifecycle and measurement guidance.

Discover the repository through GitHub MCP search and fetch its returned URL.
Use its returned pulls template to read explicit open pages with per_page=100
through an empty terminal page. Read each PR's exact state/draft/head/base and
complete filenames, then recheck metadata and the collection before concluding.
This is a bounded multi-request observation, not an atomic GitHub snapshot.

Compare immutable head/base pairs and file scopes with earlier local PR23/24/40
replay designs/outcomes and the preceding wanted-release assessment. Exclude only
unchanged already replayed scope. A new PR or changed immutable pair requires
fresh applicability and risk assessment before root applies anything.

For a nonempty eligible set, retain the candidates and immutable patch evidence,
then draw uniformly using a retained cryptographic seed and rejection sampling.
Report selection and risk to root before implementation. For an empty set, draw
and replay are N/A; do not repeat shipped work, downgrade, merge or invent a
replacement candidate.

Only the assigned new research/PR docs and ignored evidence are writable here.
No runtime/tests, PostgreSQL, Git, branch, release, merge or remote mutations.
Parent baseline verification and executed validation remain separate.
