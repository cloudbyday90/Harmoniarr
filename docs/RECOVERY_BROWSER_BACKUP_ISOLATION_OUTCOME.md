# Recovery Browser Backup Isolation — Outcome

**Status:** Local validation complete; remote Browser Validation confirmation pending
**Date:** 2026-08-29

## Delivered result

Each integration or browser scenario owns the backup files it creates. The
recovery browser workflow can therefore reliably move from **Create backup**
to **Review restore** on a Linux two-worker runner, without relying on the
production default backup path.

The integration runtime now maps `HARMONIARR_BACKUPS` to a `backups` directory
inside its temporary workspace before creating the application. This applies
to both reusable multi-scenario runtimes and single-application integration
runtimes. The production default remains untouched.

The recovery screen now announces **Creating backup** in a polite live region,
confirms a completed backup in that same region, and treats create and
inventory failures as alerts. It does not expose the backup filename, storage
path, contents, or any credential in the status message.

## Open pull request assessment

No open pull request was safely applicable to this repair:

- #40 changes the controlled-provider fixture to Node 26, which conflicts
  with the project’s current supported Node policy and is unrelated to backup
  test isolation.
- #24 and #23 propose older Docker action updates; `main` already pins newer
  releases of both actions.

None was merged or applied locally.

## Validation record

- Focused recovery presentation, composable, integration-runtime, and browser
  runtime tests passed: **12 tests, 0 failures**.
- The real recovery route test passed and now confirms the persisted backup
  file is directly under the scenario-owned `backups` directory.
- The targeted operator browser suite passed all **3 scenarios**, including
  Create backup → confirmation → Review restore.
- The complete local two-worker browser suite completed successfully.
- `npm run validate` completed successfully: linting, copyright, ESM,
  migration, schema, topology, server, client, script, and integration suites,
  followed by both production builds.

## Next recommended item

Confirm one green Linux two-worker Browser Validation run. If it is green,
begin the bounded ten-run evidence review already specified in the browser CI
compatibility plan; do not change worker count or action timeouts first.
