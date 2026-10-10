# Open PR applicability outcome: release reconciliation

Client task date: **October 10, 2026, America/New_York**.
Eligible unreplayed set: **empty**. No draw, replay, application, downgrade,
merge, branch, release or remote mutation occurred.

## Repository discovery and bounded collection

GitHub MCP repository search `Harmoniarr user:cloudbyday90` returned
[cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID `1221894481`. Fetching that actual returned URL supplied
[repository metadata](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and `https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.
The initial search round was recorded at 2026-10-10 04:03:15 UTC; the individual metadata
fetch timestamp was not separately captured.

Both initial and final reads returned three open PRs on
[page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
and an explicit empty
[page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2).
Complete per-PR metadata and filename lists were fetched at
**2026-10-10 04:08:40 UTC**. The final exact metadata and collection recheck at
**04:09:17 UTC / 00:09:17 EDT, October 10** retained the same three open,
non-draft PRs.

## Exact immutable and file comparisons

| PR | Head | Base | Complete changed-file scope | Prior evidence |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Local replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Local replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Local replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

All filename scopes were fetched freshly for this assessment. Final unchanged
head/base pairs permit reuse of those complete lists. The replay records
establish historical heads/scopes; the preceding file-match outcome also
records the immutable bases. Every observed scope is already locally replayed,
so no new applicable runtime replay exists in this observation.

## Evidence and limits

Ignored evidence under `.tmp/release-reconciliation-2026-10/`:

| Evidence | SHA256 |
| --- | --- |
| repository-discovery.json | fd67c509fb7b92a18dcc95eb27de96c911b3178ace16253a54cd4fe5e9ec567c |
| open-pr-evidence.json | 363cf26f90007891475a6600a28c3f2207b110d8394d4025ff6f14daf391213d |

The explicit terminal empty page bounds this paginated collection observation.
No Link-header, atomic/all-time absence or runtime-test claim is made. No source,
test or Git state was changed by this assessment. Parent baseline verification
and executed validation are separate evidence.

## Final precommit refresh

Client date: **October 10, 2026, America/New_York**. Fresh open-page reads at
**04:44:55–04:44:56 UTC** returned three PRs on page 1 and an explicit empty
page 2. Exact per-PR metadata at **04:44:56 UTC / 00:44:56 EDT** confirms that
PRs 23, 24 and 40 remain open, non-draft, with one changed file and the unchanged
head/base pairs listed above.

The full filename lists fetched at 04:08:40 UTC are reused only for those
identical immutable pairs. Eligible unreplayed set: **empty**. No random draw,
replay, patch application or merge occurred.

Raw collection pages, exact metadata and comparisons:
`.tmp/release-reconciliation-2026-10/pr-precommit-refresh-20261010-0444.json`
SHA256: `3ae9324131b0fbc40e75a6c577fe289d299e3ac65961136a9d14964506e852c9`.

Observed host local time on completion was
`2026-10-10T00:44:57.4848475-04:00`; observed UTC was **04:44:57 UTC**.
This read-only paginated observation is separate from the root's executed
validation and establishes no runtime-test result or atomic GitHub snapshot.
