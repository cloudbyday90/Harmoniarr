# Wanted fixture seed phase design

The preceding [replay](WANTED_WORKLOAD_REPLAY_OUTCOME.md) located the largest
noise timeout inside seeding, but did not identify its nested owner. Preserve
that failed evidence and the existing ninety-second scenario, two-client pool
and ten-second checkout policy.

## Boundaries and measurement

Introduce a narrow ESM seed observer with approved phase/context labels,
monotonic durations and nested span relationships. Await optional record sinks
and preserve the operation's result/Error/null through observer failures. Store
only bounded records in local benchmark artifacts, including failed seed work;
exclude paths, identities, SQL, command argv, output and Error payloads.

Measure consent, tooling, generated media, source inspection, candidate setup,
preparatory preview, actual canonical apply, historical receipts and receipt
validation. Nested spans cannot be added to parent durations. A media wrapper
observes actual command calls without changing argv, receiver, limits, network
isolation or private workspace mounts. Move receipt validation to its own module,
preserving exact saved scopes, physical file identities and receipt groups.

## Candidate optimization

Current seeding performs a preparatory preview before the apply worker performs
its own current preview. If native records confirm the redundant work, capture
the real worker's accepted preview for fixture evidence and omit only that
earlier preparatory preview. Keep the actual worker's inspection and operation
source/destination rechecks, delivery guards, durable publication and cleanup.
Compare a conservative `separate` mode with `worker` mode on identical reviewed
dimensions. Other recovery fixtures retain their behavior unless explicitly opted
into capturing the worker preview. No media/availability cache is introduced.

## Promotion evidence

First collect the existing separate path with new nested diagnostics on one
largest noise selection. Use those records to choose the candidate. Then prove
the actual worker preview and canonical delivery on bounded native cases, with
exact receipt/file/scope invariants and original workload result/durable/digest
comparisons. Preserve failed/partial cohorts separately. Finish the stable code
gate once; keep the explicit full matrix a separate milestone if largest seeding
still fails. Test pure observer privacy/lifetime without importing the app.

## Recommendation stack

Verified tools -> nested seed owners -> measured redundant preparation -> actual
worker preview capture -> unchanged canonical and final-byte guards -> focused
native and stable validation. Pros: actionable failure evidence and fewer
preparatory inspections. Cons: observer overhead, broader fixture-helper callers
to review, and no guarantee that this fixes the largest seed timeout. Consider
media batching only after its cost and required per-file metadata are proved.
See the separate [research](WANTED_SEED_PHASE_RESEARCH_2026_10.md) and
[outcome](WANTED_SEED_PHASE_OUTCOME.md).
