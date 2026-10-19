# Reporter ownership and completion

Use for TestsStream warnings or changes to native reporter composition. The
worked design and outcome are docs/TEST_REPORTER_OWNERSHIP_DESIGN.md and
docs/TEST_REPORTER_OWNERSHIP_OUTCOME.md.

1. Reproduce on the installed Node version with a small database-free fixture.
   Trace the emitter, event and listener count; inspect the actual composition
   owner. A threshold warning alone does not establish accumulating app leakage.
2. Prefer one owned custom consumer for related structured outputs. Keep native
   spec independent and paired with its destination. Reuse the existing bounded
   failure formatter and cohort accumulator; avoid tees, queues, private Node
   hooks, listener-limit changes and removal of foreign listeners.
3. Gate the final record on source exhaustion, not receipt of a summary. Prove
   exact case/phase/count equivalence, missing/duplicate/invalid evidence refusal,
   original source Error/null, consumer return and actual source finalization.
4. Hold a later native test and observe the early failure before releasing it.
   Retain native failure exit, strict skipped-case rejection and subprocess close/
   output drainage. Check that ordinary emitter warnings still reach native spec
   at the unchanged threshold; absence of one warning must not mean suppression.
5. Run existing process/coordinator cancellation tests, then selected real native
   files and the appropriate broad gate on stable source. Record selected scope;
   fewer custom consumers do not establish whole-CI speed or memory improvement.

The October 19 fix combines custom evidence only for cohort-enabled execution.
Direct spec plus early-failure execution remains valid. Revisit actual composition
when Node or reporter configuration changes; two reporters are a local finding,
not a universal Node limit.
