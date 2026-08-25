# Downloader Compact Handoff Outcome

Status: Implemented
Date: 2026-08-25

## Delivered Outcome

The Downloader table now places a direct Music Queue release link beneath its
primary **Details** button when the transfer has a durable, caller-scoped
release association. The existing Import Review link remains available as the
more technical secondary destination.

## Implementation Outcome

- `DownloaderTransferRowHandoffs.vue` is a focused ESM Vue component for
  compact, read-only transfer destinations.
- `DownloaderView.vue` retains transfer selection and provider operations;
  it delegates secondary destination rendering to the new component.
- Music Queue and Import Review links are conditional, keyboard-native,
  descriptive, and visually secondary to **Details**.
- The links use the existing sanitized client route helpers and do not widen
  the API or add background work.

## Security and Accessibility Outcome

- No new server request or authorization surface was added.
- An unavailable durable association produces no Music Queue link.
- The native table retains its semantics; no custom interactive grid was
  introduced.
- Link text identifies its destination, focus is visible, and minimum targets
  are 24px on desktop and 44px on mobile.

## Next Recommended Item

Add a compact filter for **Linked to Music Queue** only if operators need to
triage several linked transfers at once. First collect local-use evidence;
avoid adding another persistent filter when the live queue is typically small.
