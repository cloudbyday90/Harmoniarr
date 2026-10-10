# Open PR applicability outcome: wanted-release reconciliation

Client date: **October 10, 2026, America/New_York**. Eligible unreplayed set:
**empty**. No draw, replay, application, downgrade, merge or remote write.

## Discovery and observed collection

Fresh GitHub MCP search returned [cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID `1221894481`. Fetching its actual returned URL supplied
[repository metadata](https://api.github.com/repos/cloudbyday90/Harmoniarr) and
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.
Discovery timestamps and raw responses are retained independently of the client date.

Both initial and final reads returned three open PRs on
[page 1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1)
and an explicit empty
[page 2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2).
Full metadata and complete file lists were read at **12:02:28 UTC**.
Final collection and exact metadata recheck at **12:04:55 UTC / 08:04:55 EDT,
October 10** retained the same three open, non-draft PRs.

## Exact immutable comparison

| PR | Head | Base | Complete file scope | Prior local evidence |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

The full filename lists were fetched freshly for this assessment, then reused
only for the final unchanged immutable pairs. The replay records establish
heads/scopes; the preceding release-reconciliation outcome also records their
bases. Every observed scope has already been locally replayed.

## Evidence and limits

Ignored artifacts under `.tmp/wanted-release-reconciliation-2026-10/`:

| Evidence | SHA256 |
| --- | --- |
| repository-discovery.json | 695348606a3f9b320b2fee8fc21e7737cc4bb37142819b942f202b67295d9025 |
| open-pr-evidence.json | db0364b067cdaf97e7a45d467b04357779a116d0d3e541f22d5403909372da35 |

Actual host completion observation:
`2026-10-10T08:04:56.4429675-04:00` / **12:04:56 UTC**.
An explicit terminal empty page bounds this paginated observation; no Link-header,
atomic/all-time absence or runtime-test claim is made. Root baseline and validation
evidence remain separate. No source/test or Git state was changed by this assessment.

## Final precommit refresh

Client date: **October 10, 2026, America/New_York**. Fresh GitHub MCP repository
metadata at **12:55:19 UTC** supplied the same repository identity and actual
pulls template. Open collection reads at **12:55:20 UTC** returned three PRs
on page 1 and an explicit empty page 2.

Exact metadata at **12:55:21 UTC / 08:55:21 EDT** confirms that PRs 23, 24 and
40 remain open, non-draft, with one changed file and the unchanged head/base
pairs recorded above. Complete filename scopes from 12:02:28 UTC are reused
only for those exact immutable pairs.

Eligible unreplayed set: **empty**. No draw, replay, patch application,
downgrade or merge occurred. Fresh raw repository/pages/metadata/comparisons:
`.tmp/wanted-release-reconciliation-2026-10/pr-precommit-refresh-20261010-1255.json`
SHA256: `be04f8dd7f4b8fd64b1db4bab7647ee7a8877aaefa973c71aeec1e332885f8bc`.

Completion observations were **12:55:23 UTC** and
`2026-10-10T08:55:23.1204782-04:00`. Initial evidence remains unchanged.
This bounded read-only observation is separate from root's executed validation
and makes no atomic GitHub snapshot or runtime-test claim. This agent's
assessment is frozen after this refresh.

## Later precommit refresh

Fresh repository-backed GitHub MCP reads on **October 10, 2026** returned
three open PRs on page 1 at **13:47:55 UTC**, followed by an explicit empty
page 2 at **13:47:56 UTC**.

Exact metadata at **13:47:56 UTC / 09:47:56 EDT** again confirms PRs 23, 24
and 40 are open and non-draft, with one changed file each and the same
head/base pairs listed above. Their complete filename scopes from 12:02:28 UTC
are reused only because those immutable pairs remain unchanged.

Eligible unreplayed set: **empty**. No draw, replay, application, downgrade
or merge. Prior observations remain intact. Raw evidence:
`.tmp/wanted-release-reconciliation-2026-10/pr-precommit-refresh-20261010-1347.json`
SHA256: `0418298c780925b565dcad4813df7846343d6378a93b8c32fb26dab759c9b16e`.

Completion time was **13:47:58 UTC** /
`2026-10-10T09:47:58.7350077-04:00`. Benchmark and validation results remain
separate; this observation makes no runtime-test or atomic-snapshot claim.
No runtime/test/PostgreSQL/Git or remote mutation was performed. Assessment
is frozen after this requested refresh.
