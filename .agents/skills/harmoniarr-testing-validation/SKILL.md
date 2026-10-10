---
name: harmoniarr-testing-validation
description: Use this skill when choosing, running, or explaining Harmoniarr validation for code changes. Trigger for test planning, deciding focused versus full validation, Vue/client changes, backend service or route changes, migrations, schema snapshots, Docker/local deployment checks, release evidence, CI failures, or any request to make a change with high confidence.
---

# Harmoniarr Testing Validation

## Default Approach

Run the smallest focused tests that prove the changed behavior, then broaden based on blast radius. Before commit or push, run the validation level appropriate to the risk.

Use `npm run validate:fast` for complete static, server/client/script and build
feedback during development. It omits PostgreSQL; include the directly affected
real database tests when SQL, locks, constraints or rollback own the behavior.
Select owning services plus affected callers/consumers explicitly; filenames or
direct-import graphs alone cannot establish that selection's completeness.

Finish source review and inspect focused logs for warnings before a complete
gate. Combine affected integration files once, rather than running the new file
and then repeating it inside the same broader group. Once those pass, reserve
the complete gate for the stable final candidate; repeat it after material code
changes, failures or unresolved concerns.

`npm run validate` retains the complete serial gate; use
`npm run test:integration:serial` for its database layer explicitly. The local
two-worker experiment exposed a recovery failure and was not promoted. Read the
documented outcome before attempting further scheduling experiments; a faster
run with failures cannot replace passing coverage. Preserve per-file process isolation and serial scenarios
inside each file: the app harness changes process environment and the global
pool. Parallel files do not permit overlapping queries on one pg client or
sharing mutable scenario databases. See the repository's
`docs/TEST_EXECUTION_EFFICIENCY_DESIGN.md` and outcome for evidence and limits.

If a scheduling experiment fails, reject promotion before changing deadlines or
assertions. Stop a rejected experiment when further work cannot change that
decision, preserving actual failures and stopping only its owned resources.
Report incomplete counts honestly. Diagnose the smallest failing scope with TAP
or another reporter that exposes error details promptly; a spec-only long run
can defer stacks until its final summary. Fixture barriers should race the active
operation's failure and always release/drain in cleanup, including cancellation.

The serial integration script now pairs native spec output with an early bounded
failure reporter. Its approved category and project-relative frames become
available on native failure events; other native output is independent. For
setup investigation, enable `HARMONIARR_INTEGRATION_PHASE_TIMINGS=1`. Phase rows
contain opaque correlation, approved labels, outcomes and monotonic durations;
overlapping parent/child spans must not be summed as gate wall time. Failed
verification is not successful cleanup. See
`docs/TEST_FIXTURE_OBSERVABILITY_OUTCOME.md` for current measured limits.

Use `testing/integration/fixture-lifecycle.js` for controlled gates and tracked
cooperative work. Release failure must cancel signal-dependent drains too; an
earlier blocked task cannot hide a later rejection. These helpers do not stop
arbitrary I/O or make an unreleased client safe to close. Never terminate/drop a
database unless this invocation acknowledged creating it.
Reject pre-aborted startup and register observed completion before launching
detached work; refused late registration must not leave a worker running. Startup
failure must settle that registered completion rather than hanging its drain.

Wanted explicitly opts into a per-file migration-only template. Keep its fresh
scenario clones and idempotent migration check; do not template dedicated
migration/bootstrap/recovery validation. Use `HARMONIARR_INTEGRATION_WANTED_SCHEMA_MODE=empty`
for a comparison profile. Source admission requires verified input lineage,
connection sealing and zero active source sessions. Strict selected-mode cleanup
rejects otherwise successful work after cleanup failure; original errors still win.
See `docs/POSTGRES_TEST_TEMPLATES_DESIGN.md` and its outcome for ownership and
measurement limits. Build independent clients from owned connection config;
spreading internal `pool.options` can omit protected, non-enumerable credentials.

Use PowerShell commands from the repository root.

`npm run test:integration:shared-postgres` is an opt-in serial Wanted/catalogue
cohort. It owns one fresh server, preserving isolated file processes, databases
and pools. The default complete gate is unchanged. Do not expand its allowlist
until every fixture-created database has the parent reserve/CREATE/OID commit
contract. Raw Dockerized fixtures and manually created siblings require separate
ownership work. Close admission, observe the actual child close and known-worker
absence, then reconcile before the next file. A signal acknowledgement or reporter
end is insufficient. Unknown/replacement identities are refusals, not prefix-based
cleanup targets. See `docs/POSTGRES_TEST_LAUNCHER_DESIGN.md` and its outcome for
measured scope and process/platform limits.

## Validation Matrix

Client utility or composable:

- Focused: `node --test test/client/<matching>.test.js`
- Broader: `npm run test:client`
- Always add `npm run lint:client` for changed `src/client/**/*.js` or `*.vue`

Vue view or component:

- Focused unit tests when present.
- `npm run lint:client`
- `npm run build:client`
- Use `$webapp-testing` or `$web-design-reviewer` when layout, interaction, keyboard behavior, or responsive rendering matters.

Server service or store:

- Focused: `node --test test/server/<matching>.test.js`
- Broader: `npm run test:server`
- Add integration tests when behavior depends on real PostgreSQL state, route middleware, sessions, CSRF, operation queues, or cross-module wiring.

Route changes:

- Focused route tests in `test/server/*routes*.test.js`
- Add integration coverage for auth/session/CSRF/database-backed behavior when mocks cannot prove the contract.
- Check `src/server/route-inventory.js` when adding, removing, or changing API routes.

Migration or schema work:

- Run migration filename checks through `npm run migration:check`.
- Run schema snapshot checks through `npm run check:schema-snapshot` when the database/snapshot surface is touched.
- Run `npm run validate:schema-bootstrap` or `npm run validate:database` when bootstrap behavior matters.

Scripts or release tooling:

- Focused script tests in `test/scripts/`.
- `npm run lint:scripts`
- Run the script directly when it has observable CLI behavior.

Before commit for substantial work:

- `npm test`
- `npm run build`

Before high-risk release, Docker, or database changes:

- `npm run validate` when time and local prerequisites allow.
- Add the relevant Docker validation scripts from `package.json` only when the change affects packaging, image startup, Compose, or release evidence.

## Test Design

- Prefer tests at the module boundary that owns the behavior.
- Add route/integration tests when middleware, session freshness, CSRF, database transactions, operation-run visibility, or startup wiring are part of the contract.
- Keep test doubles small and explicit; inject dependencies into service factories rather than mocking global modules.
- Assert durable state and response shape, not implementation trivia.
- For UI state, test pure helpers and composables first; use browser checks when visual or interaction behavior cannot be proven otherwise.

## Failure Handling

When validation fails:

1. Read the first failing assertion or build error.
2. Reproduce the smallest failing command.
3. Patch the cause, not the test expectation, unless the expectation is stale because the contract intentionally changed.
4. Re-run the focused failing command.
5. Re-run the broader command that originally failed.

## Reporting

In final updates, report exact commands run and whether they passed. If a command could not run, state the concrete blocker and the remaining risk.
