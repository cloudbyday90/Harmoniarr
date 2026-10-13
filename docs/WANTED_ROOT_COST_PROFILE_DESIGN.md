# Wanted root-query and heap cost profile

Date: October 13, 2026. Baseline: `9b96d78` on main.

## Decision and scope

Implement the preceding outcome's profiling step before reducing authorization
reads. Closed receipt groups save file reads, but each member still resolves its
current private root before both hashes. At 96 receipts that means 1,344 root
resolutions over seven projections. Existing root phase timing includes SQL,
result mapping and filesystem containment; heap peaks cannot attribute allocations.

Add an opt-in `--root-costs` mode to the existing explicit benchmark. Run only
closed groups, with two alternating diagnostics-off/on pairs at each of the six
existing media/count profiles. Compare full private results, projection digests,
queries, receipts and bytes. The control measures instrumentation overhead rather
than a performance optimization. Keep the experiment outside normal test discovery.

## Ownership and bounded observations

A small ESM helper owns fixed query buckets (`rootContext`, `other`) and fixed
memory windows (`rootQuery`, `projection`, `fingerprint`, `digest`). Match the
canonical joined root statement exactly after whitespace normalization; an actual
native assertion ties its count to root resolutions, so statement drift refuses
the experiment instead of silently inventing attribution. Retain no SQL, bound
values, result rows, paths, identifiers, errors, receipts or projection objects.

Record each bucket's actual awaited duration/count/failures and each memory
window's minimum/maximum signed change for RSS, heap, external and ArrayBuffers.
Process-wide changes can include unrelated work and garbage collection; they are
observations, not allocation attribution or leak detection. Windows overlap and
cannot be summed. Digest serialization is measured separately because profiling
itself allocates. Both comparison variants keep the original periodic sampler.

Use one native connection with a fresh rollback-owned transaction per sample.
Observe completion on success or Error/null without changing the returned value.
No additional checkout, parallel query, retry, timeout increase or root reuse.
The existing owning fixture still drains actual work and owns cleanup.

## Alternatives and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Fixed opt-in cost profile | Separates SQL from root phase; bounds retained diagnostic state; exposes observer overhead | Sampled memory has weak attribution; adopt now |
| One owner-root read per opening/closing group | Potentially removes most repeated SQL/containment | Changes intermediate current-state observations; needs writer/lock and late-revocation proof first |
| Cache roots across guards | Fewer lookups | Can conceal changed owner/root authority; reject |
| Repeatable Read to stabilize roots | Stable SQL snapshot | Can conceal later committed revocation and does not freeze host bytes; reject as a shortcut |
| Heap snapshots in ordinary validation | Detailed retainers | Expensive and can expose private data; reserve for a separate restricted investigation |

Recommended stack: fixed private diagnostics → exact-work control → current-state
writer/lock inventory → bounded same-owner/requirement opening and closing reads
only if proven safe → both full hashes → existing publication/event guards.
This round delivers the first two steps. Timing alone cannot authorize the rest.

See the separate [research](WANTED_ROOT_COST_PROFILE_RESEARCH_2026_10.md) and
[outcome](WANTED_ROOT_COST_PROFILE_OUTCOME.md) documents.
