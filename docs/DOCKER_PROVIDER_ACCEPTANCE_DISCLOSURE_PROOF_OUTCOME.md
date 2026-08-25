# Docker Provider Acceptance Disclosure Proof Outcome

Date: 2026-08-25

## Delivered

The provider-acceptance browser probe now opens the existing `Advanced
diagnostics > Run history and controls` disclosure before it verifies the
visible `Download acceptance diagnostic`. It first confirms the disclosure's
visible heading, then uses its native `summary`, waits for the expanded state,
and scopes both diagnostic checks to that opened section.

The correction removes positional `.first()` diagnostic locators. This avoids
matching an intentionally hidden duplicate and keeps the proof aligned with
the operator-visible state.

## Local result

The strict local check reached its intended decision boundary: provider
configuration, a download path mapping, and a provider-accepted transfer are
already present. It stopped only because no current Downloader transfer is
linked to Music Queue. No peer-to-peer request was created during validation.

## Outcome

Pros:

- Restores a trustworthy read-only local proof for the existing diagnostic.
- Keeps advanced recovery controls out of the normal Music Queue workflow.
- Uses native disclosure semantics and visible labels rather than a custom
  accordion or a new diagnostics screen.
- Preserves the existing evidence redaction boundary.

Cons:

- The probe retains one stable structural locator to identify the native
  disclosure; the actual diagnostic assertions remain visible-text checks.
- Strict Music Queue linkage still requires an operator-created transfer.

## Next recommended item

Create one Music Queue-origin transfer in the local walkthrough, wait for it
to appear in Downloader, then run:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer --require-music-queue-link
```

If that result exposes a recovery problem, improve the one existing screen
where it occurs. Do not combine Music Queue and Downloader merely to make this
proof pass.
