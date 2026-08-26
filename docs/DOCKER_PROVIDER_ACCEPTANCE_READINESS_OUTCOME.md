# Docker Provider Acceptance Readiness Outcome

Date: 2026-08-26

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

The evidence writer now applies an ESM-only allowlist before it persists the
browser result. The artifact retains configuration-presence booleans,
aggregate counts, statuses, stable diagnostic codes, and the bounded readiness
text. It excludes application and provider endpoints, usernames, run and
candidate IDs, path prefixes, API keys, raw provider responses, transfer
identities, release titles, and screenshot paths.

The transient browser scenario still has the contextual values it needs to log
in and verify the existing interface. They are not written to the local
artifact.

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
- The saved evidence is now an explicit allowlist, so later browser additions
  cannot accidentally serialize context just because it was useful in memory.

Cons:

- The readiness result confirms mapping presence, not a specific filesystem
  translation. The existing file-backed validation owns that proof.
- It is an operator/CLI model today; a future UI may consume it only after
  observed recovery friction justifies a visible status surface.
- The artifact deliberately carries less forensic detail; follow the existing
  UI and protected service logs for a locally authorised investigation.

## Strict local probe

The healthy local walkthrough was checked with the strict, read-only command:

```powershell
node scripts/validate-docker-provider-acceptance.js --require-accepted-transfer --require-music-queue-link
```

It authenticated and returned the first unmet condition:

```text
Continue the release in Music Queue: No current Downloader transfer originated in Music Queue.
```

The probe did not create, retry, cancel, remove, or clear a peer-to-peer
transfer. It made authenticated reads and used the existing Downloader
**Refresh** interaction only. Creating a real Music Queue-origin transfer is
an operator action because it can contact an external peer/provider.

The action copy now says:

> Open Music Queue. Choose a match if Harmoniarr asks, then wait for the
> release to appear in Downloader before running this check again.

This reflects the actual workflow: Music Queue owns release decisions and
selection, while Downloader owns visible transfer state and controls. There
is no observed reason to add a combined queue/download workspace yet.

## Open pull-request assessment

Three open Dependabot pull requests were rechecked locally and were not
applied because none is applicable to this branch:

- PR #40 moves the Docker Node image to 26.7.0 while Harmoniarr currently
  supports Node 24 only (`>=24.15.0 <25.0.0`).
- PR #24 proposes `docker/build-push-action` 7.2.0; `main` already pins 7.3.0.
- PR #23 proposes `docker/metadata-action` 6.1.0; `main` already pins 6.2.0.

## Research and final recommendation stack

The design rechecked current official W3C, Docker, Playwright, and OWASP
guidance on 2026-08-26. W3C’s [status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
supports concise, programmatically identifiable results without moving focus;
the existing UI already uses that pattern for refresh feedback. Docker’s
[Compose startup guidance](https://docs.docker.com/compose/how-tos/startup-order/)
supports probing an already healthy stack rather than adding another wait
loop. [Playwright’s authentication guidance](https://playwright.dev/docs/auth)
and the [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
support transient authenticated state and persisted allowlists.

1. Keep Music Queue for release choices and Downloader for transfer controls.
2. Use the strict read-only probe after an operator has progressed a real
   Music Queue release to Downloader.
3. Persist only the allowlisted evidence module; retain detailed diagnostic
   context only in the existing protected application surfaces.
4. Add UI guidance only if a future strict result exposes repeatable operator
   friction in one existing screen.

## Validation

The following passed:

```powershell
node --test test/scripts/docker-provider-acceptance-artifact.test.js test/scripts/docker-provider-acceptance-readiness.test.js test/scripts/docker-provider-acceptance-evidence.test.js test/scripts/docker-smoke-evidence.test.js
npm run lint:scripts
npm run lint:test
npm run validate
npm run validate:security
```

The local walkthrough Compose stack was healthy and the strict read-only probe
was run as recorded above. The probe stopped at the expected missing
Music Queue-to-Downloader linkage, so no live provider request was created for
validation.

## Next recommended item

After an operator progresses a real Music Queue release to Downloader, run the
strict local probe again:

```powershell
node scripts/validate-docker-provider-acceptance.js --require-accepted-transfer --require-music-queue-link
```

If it passes, inspect only observed recovery friction before considering a
small improvement in Music Queue or Downloader. Do not add a new combined
queue/download surface unless that evidence shows the existing ownership split
is failing users.
