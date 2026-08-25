# Music Queue Release Progress Outcome

Status: Implemented
Date: 2026-08-25

## Delivered Outcome

The selected Music Queue release inspector now has a compact, ordered progress
summary for Search, Choose match, Download, and Add to library. It retains the
existing current-status explanation and state-specific controls, so the page
answers both “where is this release?” and “what, if anything, can I do now?”
without turning Music Queue into a duplicate Downloader.

## Implementation Outcome

- The wanted-release read model aggregates confirmed transfer links from
  `import_execution_transfer_links` through the release's existing discovery
  search relationship.
- The acquisition pipeline projects counts and the latest confirmation time,
  not raw provider identity or file metadata.
- A modular ESM presentation module maps state-service progress to the four
  ordered stages, including an explicit stopped state when a choice or repair
  is required.
- A focused Vue component renders semantic, textual progress with supplementary
  visual markers.
- Explicit queue refreshes announce a concise outcome through `role="status"`
  without programmatically moving focus.

## Security and Accessibility Outcome

- No mutation endpoint, provider control, or user-supplied transfer identifier
  was added.
- Existing app-user-scoped release lookup remains the authorization boundary.
- Provider usernames, transfer IDs, filenames, paths, payloads, and secrets
  are excluded from the Music Queue contract.
- Keyboard navigation continues through the existing inspector controls in
  DOM order; the progress list does not create extra tab stops.

## Next Recommended Item

Add a small, read-only handoff summary to Downloader that links a provider
transfer back to its Music Queue release only when the durable association is
available. This keeps the two views complementary: Music Queue explains the
release lifecycle, while Downloader explains provider activity.
