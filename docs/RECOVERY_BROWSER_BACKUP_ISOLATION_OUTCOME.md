# Recovery Browser Backup Isolation — Outcome

**Status:** Complete
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
- [Browser Validation run 5](https://github.com/cloudbyday90/Harmoniarr/actions/runs/33246937282)
  completed successfully on Linux with two workers. The isolated browser suite,
  evidence summary, and evidence-artifact upload all passed.

## Next recommended item

Begin the bounded ten-run Browser Validation evidence review specified in the
browser CI compatibility plan. Keep the two-worker configuration and existing
action timeout fixed during the sample so it measures the repaired baseline.
