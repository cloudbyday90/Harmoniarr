# Open PR applicability assessment outcome

Recorded October 3, 2026. Result: no applicable unreplayed candidate in the
observed open collection. The separate
[design](OPEN_PR_APPLICABILITY_2026_10_DESIGN.md) records the eligibility method
and decision rationale.

## Fresh collection evidence

GitHub MCP repository search resolved `cloudbyday90/Harmoniarr`, repository ID
`1221894481`, and its canonical
[repository URL](https://github.com/cloudbyday90/Harmoniarr). Fetching that URL
returned the [API repository URL](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and `pulls_url` template
`https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}`.
Resolving the returned template produced the
[open collection request](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1).

The collection capture was timestamped `2026-10-03 18:16:02 UTC`. It returned
three open, non-draft items, in order `[40, 24, 23]`, with `per_page=100` on
page 1. The connector response did not expose HTTP `Link` headers, and no second
page was requested. The short response supports the inference that another page
was unnecessary; this outcome does not claim independently traversed pagination
or observed next-page-header evidence.

The local HEAD read during the assessment was
`af7336013e58ebd3524e2e08c11b6009380335bc`.

## Exact replay-identity comparisons

All three fresh full head SHAs exactly match the immutable heads in their prior
replay design documents. Follow-up changed-filename checks completed at
`2026-10-03 18:17:54 UTC`; the returned paths also exactly match those records.

| PR | Identical prior and fresh immutable head | Fresh changed filename | Prior replay result |
| --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | `.github/workflows/release-image.yml` | [PR 23 outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | `.github/workflows/release-image.yml` | [PR 24 outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | `compose.controlled-provider-fixture.yaml` | [PR 40 outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

The comparison used
[PR 23 design](RANDOM_PR_23_LOCAL_REPLAY_DESIGN.md),
[PR 24 design](RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md), and
[PR 40 design](RANDOM_PR_40_LOCAL_REPLAY_DESIGN.md). Their previously retained
patch scopes are, respectively, metadata-action v6.1.0, build-push-action v7.2.0,
and the controlled-provider fixture's `node:26.7.0-alpine` reference. The prior
outcomes document exact local replay and maintained successor decisions.
No materially changed head or changed-file scope was observed this round.

The collection also reported base SHA
`0b661a2a5a5e6318683ee980c3c5d02298987e9d` for PRs 23/24 and
`4429a4d6146b16bde16ba01298d39a5d2494e0aa` for PR 40. These are PR metadata
values, not a fresh resolution of current main. Complete PR patches were not
re-fetched; the assessment compared immutable head identity and file scope,
rather than claiming a newly calculated patch digest.

## Disposition

The eligible set is `[]`: all observed scopes were already locally replayed and
remain unchanged. No cryptographic draw, candidate selection, reimplementation,
downgrade, or PR merge occurred. Existing runtime replay results remain in the
linked prior outcomes; this is a fresh applicability assessment, not another
runtime execution or a maintained dependency update.

## Retained evidence

Evidence is retained under the ignored local directory
`.tmp/library-add-recovery-2026-10/pr-applicability/`. SHA-256 hashes below bind
the retained JSON snapshot files; they do not attest to later GitHub state.

| Evidence filename | SHA-256 |
| --- | --- |
| `repository-metadata-20261003T181602Z.json` | `93ec9b75384518ddf56c807bf2b82c81658c0ab2572ce6f8161b0d810323fc11` |
| `open-prs-20261003T181602Z.json` | `b1b6834745530ebfe24fe26d638d80bf754eda07e7ab91354c8c806c80ae34e0` |
| `head-and-scope-comparison-20261003T181754Z.json` | `a426be6eba1dc595eea22cacef4fe6977e0ea867fc76bb018b461e15342bc99f` |
| `changed-filenames-20261003T181754Z.json` | `a029f858f7315d1ba753c172ddcdf145bf3547cb189719aff21abd0befefa99e` |

The directory also contains the compact initial applicability record and local
review. The raw collection items and changed-filename tool responses preserve
the source observations behind the head/scope comparison. The completeness
flag in the compact comparison record must be read with the first-page coverage
limit above; it is not independent HTTP pagination evidence.

## Evidence limits

The result is bounded to the fetched collection snapshot and the recorded prior
replay identities. It verifies unchanged heads and filenames, not previous runtime
execution afresh, current upstream releases, application behavior, hosted runner
acceptance, or release acceptance. PR state may change after consultation.

No application/test source, dependency reference, or runtime fixture was changed
in this assessment. No application tests or replay harnesses were run. Only the
two applicability documents were authored after the read-only research artifacts.
No commit, push, branch, remote comment, workflow dispatch, registry publication,
release, or merge was performed by this assessment.
