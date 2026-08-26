# Browser validation secret-input design

Status: Implemented

## Context

The provider-acceptance validator already supported a password-only secret
file, but the packaged-runtime browser smoke and its optional release-evidence
step still accepted passwords only through a CLI argument or environment
variable. Environment variables and process arguments are convenient for a
disposable local walkthrough, but they create avoidable exposure to process
inspection, logs, crash reports, and shell history.

This design extends the existing ESM input boundary instead of duplicating file
reads in each command. It does not change browser scenarios, product UI copy,
or acquisition behavior.

## Official guidance reviewed

As of August 2026:

- OWASP recommends avoiding hard-coded secrets and notes that environment
  variables can be visible to other processes, logs, or dumps:
  <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>
- Node documents `node:fs/promises` as its stable promise-based file API,
  suitable for an ESM command to read its transient input without blocking the
  event loop: <https://nodejs.org/api/fs.html>
- Playwright warns that persisted authentication state can contain cookies and
  headers that impersonate a test account and should not be committed. The
  commands therefore continue to use fresh transient browser contexts instead
  of writing reusable authentication state:
  <https://playwright.dev/docs/auth>
- WCAG 2.2 requires programmatically determinable status messages for web UI
  updates. This command-only change does not alter Harmoniarr UI status
  components; its existing browser scenario remains based on user-visible,
  accessible UI semantics: <https://www.w3.org/TR/wcag/>

## Decision

Add a reusable ESM `getOptionalSecretInput` helper beside
`getRequiredSecretInput` in `scripts/secret-input.js`. Both enforce exactly
one configured source and redact file-system details from failures.

| Command | Preferred source | Compatibility source |
| --- | --- | --- |
| `validate:docker-browser-smoke` | `--password-file` or `HARMONIARR_WALKTHROUGH_PASSWORD_FILE` | `--password` or `HARMONIARR_WALKTHROUGH_PASSWORD` |
| `validate:release-evidence-pack --include-browser-smoke` | `--browser-password-file` or `HARMONIARR_WALKTHROUGH_PASSWORD_FILE` | `--browser-password` or `HARMONIARR_WALKTHROUGH_PASSWORD` |

The file must contain the password only, with an optional final newline. The
helper keeps it in memory only, never returns file metadata, and reports only a
stable environment-variable name if the file cannot be read.

## Pros and cons

| Option | Pros | Cons |
| --- | --- | --- |
| File-backed input (selected) | Avoids command-line exposure; consistent across all local browser validators; works with local secret-file workflows | Operator must create and protect one password-only file |
| Direct argument or environment input | Convenient for an existing disposable walkthrough | Easier to leak through shell history, process inspection, logs, or dumps |
| Persisted Playwright authentication state | Can make repeated browser runs faster | Introduces a more sensitive artifact lifecycle and is unnecessary for these focused smoke commands |

## Final recommendation stack

1. Use a password-only file outside the repository for local browser-validation
   credentials.
2. Use the shared ESM resolver with one source only; never log secrets, paths,
   or browser authentication state.
3. Continue creating a fresh browser context per run and archive only the
   intentionally generated JSON evidence and screenshots.
4. Retain direct inputs only for backward-compatible, disposable local use.

## Non-goals

- No changes to the Home, Music Queue, Downloader, Missing, or Artist UI.
- No persisted Playwright storage state.
- No provider configuration, search, request, or peer-to-peer transfer.
