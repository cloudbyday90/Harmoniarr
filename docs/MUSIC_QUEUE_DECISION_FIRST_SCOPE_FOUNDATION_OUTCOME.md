# Music Queue Decision-First Scope Foundation Outcome

Status: Implemented 2026-08-23

## Outcome

Music Queue now defaults to **Actions** rather than `Current work`.
The page separates operator decisions, active automatic work, scheduled work,
and complete release history into explicit scopes with live counts.

The header explains automatic progress only as supporting context. It does not
promise a download or library addition; eligibility and existing safety checks
remain authoritative.

## Changes

- Added `music-queue-scope-presentation.js`, an ESM-only module that classifies
  every normalized release into its operator-facing scope and generates scope
  labels, counts, status text, and empty-state copy.
- Added `music-queue-filter-presentation.js`, an ESM-only module that owns
  deliberate query, type, state, and scope filtering.
- Removed queue list-filter ownership from the broad acquisition-pipeline
  presentation module.
- Updated `MusicQueueView.vue` to use `Actions` by default; show
  scope counts; use clearer visible labels; remove the duplicate Activity
  destination; and preserve the selected scope when clearing narrowing filters.
- Added a concise live status message only for an explicit scope change, so
  background polling does not create repeated assistive-technology noise.
- Added focused scope and filter tests.

## Security And Data Boundary

This is presentation-only. It does not add privileged actions, reveal provider
secrets or remote paths, alter wanted state, or bypass existing CSRF,
authorization, fresh-session, or release-scope checks. Safe add-to-library
confirmation remains unchanged.

## Open Pull Request Review

Dependabot PR #41 was applied locally without committing. Its lockfile changes
conflicted because the current branch already resolves newer Vue language-tool
and ESLint versions. Accepting the PR would downgrade those resolved packages,
so it was not incorporated. No pull request was merged.

## Validation

- `npm run validate` passed, including the ESM guard, linting, server/client/
  script tests, integration tests, and production builds.
- Focused browser verification passed for Music Queue scope, row hierarchy,
  waiting and library-add states, plus the affected Activity and Downloader
  handoffs.
- The documented walkthrough Compose rebuild completed successfully. The
  `harmoniarr` container is healthy at `127.0.0.1:47956`, and the one-shot
  bootstrap confirmed the local walkthrough administrator already exists.

## Next Item

Make the unselected release list full width and render the selected-release
inspector only after an explicit selection. That removes the largest unused
area without weakening the existing safe review workflow.
