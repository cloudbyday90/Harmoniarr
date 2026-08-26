# Docker provider acceptance secret-input design

**Status:** implemented 2026-08-26

## Problem

The strict local provider-acceptance probe logs into the local walkthrough so
it can make authenticated, read-only checks of Music Queue and Downloader.
It previously accepted that browser password through `--password` or
`HARMONIARR_WALKTHROUGH_PASSWORD` only. A command-line password can be visible
to local process inspection, and an environment variable can be inherited more
widely than the short-lived browser process requires.

The probe must become easier to use with a protected local secret without
changing its scope: it still must not choose a match, enqueue, retry, cancel,
remove, or clear a peer-to-peer transfer.

## Research basis

Research was checked against official sources on 2026-08-26.

- [Docker Compose secrets](https://docs.docker.com/reference/compose-file/secrets/)
  describes sensitive values supplied from a file or external source. The
  probe follows the same file-backed principle for its local browser login.
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
  supports deliberate secret-management controls rather than treating a value
  as ordinary configuration.
- [Node.js File System API](https://nodejs.org/api/fs.html) provides stable
  promise-based file reads; the new helper uses `node:fs/promises` and keeps
  the value in memory only.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires server-side checks on every request. This client-side input change
  does not change Harmoniarr's existing authenticated, server-authorized API
  boundary.
- [W3C WCAG Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  supports concise programmatically determinable feedback without moving
  focus. The probe continues to report one bounded result rather than exposing
  secret-read details in a user-facing surface.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep only `--password` | Minimal implementation | Exposes a secret through command arguments | Rejected |
| Keep only the environment variable | Backward-compatible | May be inherited by child processes and does not match the existing file-secret practice | Retained as compatibility only |
| Parse `docker/walkthrough.env` as a password file | No extra file for the disposable walkthrough | Mixes dotenv parsing with a generic secret reader and accepts more data than the probe needs | Rejected |
| Add a password-only secret file input | Narrow read, no command-line value, reusable ESM helper, preserves backward compatibility | Operator manages one protected local file | Chosen |

## Recommended design

1. Add an ESM-only `secret-input.js` helper that accepts exactly one direct or
   file-backed source, reads a password-only file asynchronously, trims only
   surrounding whitespace, and returns the value in memory.
2. Add `--password-file` and
   `HARMONIARR_WALKTHROUGH_PASSWORD_FILE` to the provider-acceptance CLI.
3. Reject ambiguous direct-plus-file input. Report a stable environment-variable
   name for missing, unreadable, or empty file input; never echo the path,
   content, or underlying filesystem error.
4. Retain `--password` and `HARMONIARR_WALKTHROUGH_PASSWORD` solely for
   compatibility with existing disposable walkthrough automation.
5. Keep the persisted evidence allowlist unchanged: browser credentials and
   secret-file paths never enter an artifact, log message, readiness object,
   or screenshot name.
6. Document that `docker/walkthrough.env` is not a password-only secret file.

## Security and W3C boundary

The file is an operator-supplied local input, not a new Harmoniarr setting or
API. The probe reads it once, uses it only to populate the login form in a
transient Playwright context, and closes that context after the existing
read-only checks. Every app request remains authorized by the server.

There is no visible UI change, focus change, or status announcement. The
existing concise readiness result remains the operator-facing outcome and
continues to describe what action is missing without claiming a transfer has
started or completed.

## Final recommendation stack

1. Prefer a password-only local secret file for provider-acceptance browser
   login.
2. Keep direct environment/CLI values as temporary compatibility inputs only.
3. Reject dual sources and redact file errors by design.
4. Keep credentials and file paths out of evidence artifacts and terminal
   success/failure detail.
5. Run the strict probe only after an operator has deliberately progressed a
   Music Queue release to a configured provider; the probe itself remains
   read-only.
