# Backup failure precedence design

October 26, 2026. Follows [I/O drainage](BACKUP_IO_DRAIN_OUTCOME.md).

Keep the exact original failure from publication/deletion, including frozen Error
objects and thrown null/undefined. Await the existing error-only journal write.
If that write fails, await a bounded secondary diagnostic and then rethrow the
original failure. Do not mutate the original with `cause`, wrap it in an aggregate,
retry an uncertain SQL write, or use another connection to bypass lost ownership.

Separate this policy into an ESM failure-recorder factory. It records the existing
finite-code, path-free journal explanation and returns an explicit recorded
boolean. The default diagnostic uses the existing runtime reporter with a fixed
event code. An empty UPDATE result is unrecorded, not a successful acknowledgement.
It includes finite operation/primary/secondary categories and a validated UUID
reference. No raw error, message, stack, SQL, filename or path is passed to the
diagnostic callback. Diagnostic callback failure cannot mask the primary failure.

Publication/deletion always rethrow the original after failure recording settles.
Recovery retains ordinary per-operation deferred behavior only when recording
succeeds. If recording fails, recovery stops and throws the primary failure;
there is no successful aggregate or invented persisted outcome. Local admission
continues to cover returned work, including diagnostic reporting and client cleanup.
Do not change durable phase/link/completion fields through this recorder.

Recommended stack: original failure → existing safe journal projection → awaited
error-only recording → bounded secondary diagnostic if needed → original throw,
or ordinary deferred recovery when the journal write succeeded.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Propagate journal failure | Simple | Masks the causal failure | Reject |
| Wrap or attach secondary raw errors | Carries both errors | Changes identity/null contract; can expose SQL/paths and mutate frozen objects | Reject |
| Ignore recording failure silently | Preserves original | Conceals missing diagnostics | Reject |
| Preserve original with awaited bounded secondary report | Keeps identity and observability; no authority bypass | Secondary report is not durable if both sinks fail | Adopt |
| Retry or borrow another database client | Might record later | Uncertain commit/owner state; extra contention and authority risk | Reject here |

Validate the primary/secondary/reporter matrix at the helper and caller boundaries,
then qualify actual permission failures plus rejection of the real journal UPDATE
on disposable PostgreSQL. Terminate an owned backend during admitted controlled
file failure, retain Error/null through the default production facade and verify
fresh recovery and local drain behavior. Keep existing journal/drain/publication
regressions, one stable bounded full gate and a no-cache Docker rebuild.

PR #56 was randomly selected from the two open PRs. Apply its exact package and
lockfile patch locally, keep it unmerged and verify the upstream Vite 8.3.5 and
Vue Router 5.4.0 changes. Source uses stable `createRouter`, without experimental
router imports. Still test the complete client build and packaged browser routing;
changed bundles cannot inherit old browser proof solely from unchanged Vue source.

No new UI, schema, release, process or queued work is introduced. The existing
single-process drainage and filesystem trust limits remain. Diagnostics are
best effort and must not be presented as durable journal success.
