# Docker Provider Acceptance Readiness Outcome

Date: 2026-08-25

## Delivered

The Docker provider-acceptance validator now evaluates an ESM-only readiness
policy before it applies strict requirements. A missing requirement produces
one bounded result with:

- a clear label;
- a concise explanation of what is missing; and
- one next action in the existing Harmoniarr surface.

Strict mode still exits unsuccessfully. When an evidence path is configured,
the validator writes the safe readiness artifact before that failure. This
makes local troubleshooting repeatable without converting a missing
prerequisite into a passing check.

The artifact now retains counts and configuration booleans only. It no longer
contains path prefixes, API keys, provider endpoint values, raw provider
responses, transfer identities, or release titles.

## Design outcome

The selected stack is a small policy module plus the existing browser probe
and evidence contract. This keeps the logic testable and reusable without
adding another Downloader or Music Queue screen.

Pros:

- The next action is explicit and calm instead of an internal assertion.
- A strict result remains suitable for CI and scripted local verification.
- Saved evidence is safer to retain or attach to local troubleshooting notes.
- The first unmet condition avoids presenting a long checklist when one action
  will unblock the next check.

Cons:

- The readiness result confirms mapping presence, not a specific filesystem
  translation. The existing file-backed validation owns that proof.
- It is an operator/CLI model today; a future UI may consume it only after
  observed recovery friction justifies a visible status surface.

## Open pull-request assessment

Three open Dependabot pull requests were rechecked locally and were not
applied because none is applicable to this branch:

- PR #40 moves the Docker Node image to 26.7.0 while Harmoniarr currently
  supports Node 24 only (`>=24.15.0 <25.0.0`).
- PR #24 proposes `docker/build-push-action` 7.2.0; `main` already pins 7.3.0.
- PR #23 proposes `docker/metadata-action` 6.1.0; `main` already pins 6.2.0.

## Validation

The following passed:

```powershell
node --test test/scripts/docker-provider-acceptance-readiness.test.js test/scripts/docker-provider-acceptance-evidence.test.js test/scripts/docker-smoke-evidence.test.js
npm run lint:scripts
npm run lint:test
npm run validate
npm run validate:security
```

The local walkthrough Compose stack was already healthy. Its credentials were
not available in this shell, so the authenticated browser probe was not run
against that preserved instance; no credentials were guessed, read, or logged.

## Next recommended item

Run the strict local probe against a real Music Queue-origin transfer:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer --require-music-queue-link
```

Use the resulting readiness label to decide whether a single existing screen
needs recovery guidance. Do not add a new combined queue/download surface
until that observed result shows it is necessary.
