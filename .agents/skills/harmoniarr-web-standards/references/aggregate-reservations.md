# Aggregate artwork reservations

Use for weighted admission, decoder handshakes or parent-buffer accounting inside
the existing app. Read [worker memory](worker-memory.md) for DATA/RSS distinctions.

## Choose a live ownership model

Trace buffer, file-read, child and publication lifetime through the one ingestion
admission owner. Keep waiting-byte, active-count and active-reservation bounds
separate. A free-memory snapshot is not a reservation; a reservation estimate is
not physical RAM, RSS containment or protection for unrelated application work.

Do not introduce a second queue or app to implement a weighted budget. Extend the
current FIFO only when its original settlement/cancellation contract is preserved.
Check fairness when a memory-blocked head exists while a count slot is free.

Avoid hold-and-increase deadlocks: two baseline holders can both wait forever for
more memory. Harmoniarr reserves a conservative full-job allowance before intake,
then permits only reductions after native metadata. Keep initial parent copies,
child allowance and input upper bounds explicit; tighten file bounds only using
the actual bounded read. Underutilization and capacity refusals are real costs.

## Grant and retire

1. Give the child bounded input length/policy and its existing minimal environment.
2. Read exact binary bytes without interpreting control bytes as image data.
3. Inspect/validate metadata in the limited child; expose only the approved numeric/
   enum projection. Bound its schema and header separately from final output.
4. Synchronously reduce the original task's reservation, recheck deadline/abort,
   then grant. Do not accept an async ownership callback as completed authority.
5. Require exact grant bytes plus EOF before rewriting. ASCII decoding can mask
   high bits; compare the original control bytes. Refuse pre-grant output/replay.
6. Validate result format/dimensions against metadata and require exact body, zero
   exit and actual close. Hold the remaining reservation through parent publication.

Active abort/kill return/exit do not release capacity. Error/null stays original
through generic admission; worker protocol failures remain fixed private temporary
errors. Late capability use must fail before altering accounting for a new owner.

## Evidence

Prove FIFO reduction/handoff, cancelled-head progress, expiry, invalid expansion,
late reduction and Error/null. Hold publication after actual child retirement and
assert queued file intake has not started. Then use actual native children and
unchanged hashes to prove the default budget serializes maximum-pixel work.

Keep a separately configured larger-budget parallel control distinct from default
throughput. Preserve native-active cancellation after metadata/grant; cancelling
the newly added metadata frame alone does not prove native rewrite cancellation.
Run the existing corpus and both lifecycle/resource lanes on the rebuilt image.
State that the logical budget does not isolate compromised native code or reserve
kernel/cgroup memory.

See [design](../../../../docs/ARTWORK_AGGREGATE_DESIGN.md),
[research/tradeoffs](../../../../docs/ARTWORK_AGGREGATE_RESEARCH.md) and
[outcome](../../../../docs/ARTWORK_AGGREGATE_OUTCOME.md).
