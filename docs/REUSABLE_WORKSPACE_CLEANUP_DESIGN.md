# Reusable fixture workspace cleanup design

This implements the next adoption prerequisite from the
[media scale outcome](MEDIA_API_SCALE_OUTCOME.md). Reusable app fixtures need
their own cleanup authority before an owned executor can safely use their files.
Application source, schema, resource limits and media execution defaults remain
unchanged. No executor is enabled globally in this slice.

## Findings and boundaries

The previous reusable runtime ignored a per-scenario cleanup predicate. Its
outer cleanup could recursively erase a retained scenario or delete the root
while a scenario was still running. Reusing a scenario name also reused its
directory. `keepArtifactsOnFailure` did not survive outer root deletion.

`fixture-runtime-lifetime.js` owns admission and the returned isolated-database
operation. Admission registers synchronously; cleanup seals new admission
synchronously, drains every already-admitted operation and returns one canonical
cleanup promise. Database cleanup and shared-pool closure cannot run ahead of
an admitted scenario. This adds no queue, parallel scheduling, retry or timeout.

`fixture-workspace-owner.js` owns directories and retention. It captures canonical
absolute paths and current directory identity using `lstat`/`realpath` with exact
BigInt device/inode values. A scenario name is a bounded ASCII label, not a path;
each invocation gets a new `mkdtemp` child. Both root and child identity are
rechecked before recursive deletion. Replacement directories and junctions cannot
inherit the captured directory's observed cleanup authority.

`createIntegrationAppRuntime` accepts a runtime-wide `workspaceCleanupGuard`.
`runScenario` accepts a per-invocation predicate with the same name. Both must be
functions, and both applicable predicates must return exactly `true` before child
removal. The runtime predicate also protects root removal. Predicates are awaited
after returned app/HTTP/worker cleanup, pool closure and environment restoration;
they must own any additional resource completion they certify. The existing
150 ms drain delay is not proof that an external process stopped.

An uncertain predicate, changed identity or failed deletion retains that child
and permanently vetoes parent removal for this runtime. Later successful siblings
cannot clear that veto; fresh same-name directories keep them separate. A
successful body with refused cleanup fails with `fixture_workspace_not_quiescent`.
An earlier Error/null/undefined rejection remains primary, including through a
later PostgreSQL cleanup failure. Resource release still runs. Runtime cleanup
reports the original unsafe failure rather than overwriting it with a second
refusal. There is no automatic retry or later retroactive cleanup grant.

When `keepArtifactsOnFailure` retains a failed callback's directory after safe
quiescence, parent cleanup preserves it without adding a cleanup failure. This
does not claim retention of files already removed before a later database-drop
failure. Startup failures keep their original rejection while applying the outer
guard to their captured root.

Directory checks are current evidence immediately before deletion, not an atomic
OS deletion capability against arbitrary concurrent host filesystem writers.
The fixture contract assumes cooperating owners and private temporary directories.
Raw paths, database credentials and arbitrary predicate errors do not enter phase
records. The existing functional fixture is unchanged in this slice.

## Usage and validation

An explicit executor pilot can pass a closure over its own executor:

```js
let executor;
await runtime.runScenario(async context => {
  // Create, use and close this scenario's resource through its actual owner.
}, {
  scenarioName: 'owned_media_case',
  workspaceCleanupGuard: () => !executor || executor.canRemoveWorkspace(),
});
```

The predicate can await owned completion, but must return true only after that
completion is verified. It is not authorization to guess a container name or
remove a retained directory. Scenario labels allow 1–96 ASCII letters/digits,
hyphens and underscores, starting with a letter/digit. Filesystem paths come
from the supplied context, not from reconstructing the label.

Validation separates pure filesystem/lifetime controls, real app adapter wiring,
and a focused serial PostgreSQL/Docker cohort. The native guard holds a real media
mount while runtime cleanup is requested, then closes/verifies the executor before
deletion. A refused native child and an independently successful same-name sibling
prove parent retention. Existing checkout and worker-lifetime cohorts remain.

## Recommendation stack

| Choice | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Guarded children plus admission drainage and parent retention | Protects both owners; preserves exact failures; isolates repeated names | Retained evidence needs deliberate later handling; several filesystem checks | Implemented |
| Only add a child predicate | Small change | Parent cleanup can still erase retained/live files | Insufficient |
| Automatically delete retained roots after a delay/retry | Less leftover data | Time does not prove process quiescence or directory ownership | Reject |
| Enable owned API execution in every reusable fixture now | Potential CLI savings | Consumer completion and defaults have not been reviewed | Defer |

Final stack: captured directory identity -> awaited per-resource predicates ->
sticky child retention -> drained isolated-database work -> verified parent
cleanup. Next adopt an explicit owned API executor in one reusable canonical
media cohort, retaining every current inspection/private comparison and measuring
the selected cohort before broader defaults change. See the
[research](REUSABLE_WORKSPACE_CLEANUP_RESEARCH_2026_10.md) and
[outcome](REUSABLE_WORKSPACE_CLEANUP_OUTCOME.md).
