# Batch-handoff open-PR applicability outcome

Recorded 8 October 2026 local / 9 October UTC. The eligible unreplayed set is
empty. No random draw, local reimplementation, downgrade, or PR merge was
applicable. Selection rules are in the separate
[design](OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_DESIGN.md).

## Fresh discovery and collection

GitHub MCP search discovered [cloudbyday90/Harmoniarr](https://github.com/cloudbyday90/Harmoniarr),
repository ID 1221894481, at 03:13:09 UTC. Full repository metadata read at
03:13:24 returned the [REST repository](https://api.github.com/repos/cloudbyday90/Harmoniarr)
and pull template https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls{/number}.
The template supplied the collection endpoint below; it was not invented.

| Observed request | 9 October UTC | Result |
| --- | --- | --- |
| [Initial page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 03:13:38 | Three open nondraft PRs, response order 40,24,23 |
| [Initial page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 03:13:38 | Empty array |
| Per-PR metadata and complete filename tool | 03:13:55 | Same immutable heads/bases; one changed file each |
| [Final page1](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=1) | 03:14:08 | Same three PRs, heads and bases |
| [Final page2](https://api.github.com/repos/cloudbyday90/Harmoniarr/pulls?state=open&per_page=100&page=2) | 03:14:08 | Empty array |

## Immutable comparison

| PR | Exact current and replayed head | Base | Complete changed filename | Prior outcome |
| --- | --- | --- | --- | --- |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | ae651337286216e92be7ae977e39fcedc14de7f9 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Exact metadata-action replay](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md) |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | 40cf4d117b69bd55b9a0a7353361838216e1e952 | 0b661a2a5a5e6318683ee980c3c5d02298987e9d | .github/workflows/release-image.yml | [Exact build-push-action replay](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | 649659f1e199d48d55cc8d5cccf9f079dc235d86 | 4429a4d6146b16bde16ba01298d39a5d2494e0aa | compose.controlled-provider-fixture.yaml | [Exact Node26.7 fixture replay](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md) |

Earlier replay designs/outcomes and the preceding immutable applicability record
establish the historical heads, bases and scopes. Every fresh head/base/file scope
remained identical. No newly applicable patch was found; no patch was executed
or refetched merely to repeat unchanged work.

## Retained evidence and limits

All files below are under ignored .tmp/batch-handoff-2026-10/pr-applicability/.

| Evidence file | SHA-256 |
| --- | --- |
| repository-discovery.json | 5d2690923fdb436622c93773299319fdeb2695dbfa2ee02b73b5ae3214080808 |
| open-pr-collection.json | e817dcdd52ba1dc617feb61a706b1eb31948e3ec646b4c82387c8a743f62b0cf |
| head-scope-comparison.json | fd32027af5f939a4042a61fac0386189afc113f52b18cceadb0853cac5a5b6ac |

Explicit page2 reads establish the observed boundary; no HTTP Link headers were
exposed. Collection, head, and filename reads were separate, not an atomic GitHub
snapshot. Later opening/rebasing of a PR requires another assessment.
Root supplied baseline ac4993f; this subtask ran no Git command to verify it.
No runtime/test/Git mutation or external write occurred.
