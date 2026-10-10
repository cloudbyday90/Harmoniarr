# Open PR applicability outcome: test fixture observability

Client date: October 10, 2026, America/New_York. Eligible unreplayed set:
**empty**. No random draw, replay, application, downgrade, merge or remote write.

## Repository and collection

Fresh GitHub MCP search returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr), repository
ID `1221894481`. Fetching the returned URL supplied the actual repository
metadata and pulls template:
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.

Correctly parameterized reads returned three open PRs on
[page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
at **14:07:09 UTC**, and an explicit empty
[page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2)
at **14:08:22 UTC**. Final collection reads at **14:09:15 UTC / 10:09:15 EDT**
again returned three and zero. Exact full metadata was rechecked at 14:08:47 UTC;
the later collection retained the same state and immutable pairs.

## Immutable scope comparison

| PR | State/draft | Head | Base | Complete filename scope | Prior local outcome |
| --- | --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | open / false | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | open / false | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | open / false | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Fresh complete filename reads each returned one file, matching the full metadata's
changed_files=1. Those scopes were reused for rechecks only because the immutable
pairs remained unchanged. Earlier replay designs/outcomes establish heads/scopes;
the preceding [wanted assessment](OPEN_PR_APPLICABILITY_WANTED_RELEASE_2026_10_OUTCOME.md)
also records these bases. Every observed patch scope is already implemented locally.

## Evidence and limits

Fresh search, metadata, explicit pages, full PR records, complete filenames and
rechecks are retained in
`.tmp/test-fixture-observability-2026-10/pr-applicability/open-pr-assessment.json`.
SHA256: `8a4333c4e5b48f8d17f971bca5ee98778c1a94c93c5c5d2a688bfb78780c5716`.
Retention completed at **14:10:04 UTC**, with host observation
`2026-10-10T10:10:04.9367186-04:00`.

A first attempt to form page 2 replaced the substring inside per_page and fetched
page 1 with per_page=200. That raw response is retained as a navigation correction,
not counted as terminal-page evidence. Explicit query construction corrected it;
both correctly parameterized collection passes reached empty page 2.

No Link-header, atomic snapshot, all-time PR absence or runtime test claim is made.
Executed parent validation remains separate. No source/test, PostgreSQL or Git
state changed by this assessment. Eligibility assessment is frozen after these
reads; a later newly changed patch requires fresh review.

## Final precommit refresh

Client date: October 10, 2026, America/New_York. Fresh GitHub MCP repository
metadata at **15:03:51 UTC** supplied the same actual repository identity and
pulls template. Explicit open collection reads at **15:03:52 UTC** returned
three PRs on page 1 and zero on the terminal page 2.

Full PR metadata at **15:03:52 UTC / 11:03:52 EDT** confirms PR23, PR24 and
PR40 remain open and non-draft, with exactly the head/base pairs listed above
and one changed file each. Complete filenames from this slice's initial evidence
are reused only for those unchanged immutable pairs. All three observed patch
scopes remain previously replayed; the eligible unreplayed set is **empty**.
No random draw, replay, application, downgrade, merge or external write occurred.

Fresh repository/pages/full metadata and exact comparisons:
`.tmp/test-fixture-observability-2026-10/pr-applicability/pr-precommit-refresh-20261010-1503.json`.
SHA256: `971b6ee8662b72c25511eddf758e1d1989fdffa41c5d2356f7bb93804393f50a`.
Retention completed at **15:04:13 UTC**, with host observation
`2026-10-10T11:04:13.8543040-04:00`. Initial records remain intact.

This bounded multi-request observation is separate from the parent's executed
full validation. It makes no atomic GitHub snapshot or Link-header claim.
No runtime/test/PostgreSQL/Git mutation was performed. PR assessment is frozen
after this requested refresh.

## Later final precommit refresh

Fresh GitHub MCP search and returned repository metadata on October 10, 2026
again resolved repository `1221894481` and its actual pulls template.
Open page 1 at **15:53:24 UTC** returned three PRs; explicit terminal page 2
at **15:53:25 UTC** returned zero.

Full records at **15:53:25 UTC / 11:53:25 EDT** retain the exact PR23/24/40
heads and bases in the table above, open state, non-draft status and one changed
file each. Complete initial filename scopes are reused only for those unchanged
immutable pairs. Eligible unreplayed set remains **empty**; no draw, replay,
local application, downgrade, merge or remote mutation.

Fresh search/metadata/pages/full records/comparisons:
`.tmp/test-fixture-observability-2026-10/pr-applicability/pr-precommit-refresh-20261010-1553.json`.
SHA256: `beee654d24d65ba7b6e4ce8645022ee0a0c4ecfeb98ae0b13e41dbda83945246`.
Retention completed at **15:53:43 UTC**, with host observation
`2026-10-10T11:53:43.4278664-04:00`. Earlier records remain intact.
This observation is separate from parent validation and makes no atomic-snapshot
or Link-header claim. No runtime/test/PostgreSQL/Git changes; assessment frozen.
