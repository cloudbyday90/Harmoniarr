# Downloader Music Queue Handoff Outcome

Status: Implemented
Date: 2026-08-25

## Delivered Outcome

Transfer details can now link directly to its associated Music Queue release
when, and only when, Harmoniarr has a durable, caller-scoped association. The
link names the destination release and remains read-only.

## Implementation Outcome

- A small ESM server service resolves persisted candidate `musicQueue`
  wanted-release IDs to a release owned by the authenticated administrator.
- The existing transfer linkage service composes that result into the
  Downloader read model without changing provider actions or adding a new API
  endpoint.
- The Downloader queue route passes the authenticated app-user ID to the read
  model, closing a potential cross-operator read-projection gap.
- A focused ESM client helper owns route construction and descriptive link
  naming.
- The existing native dialog renders the handoff as a labeled definition-list
  row and maintains its normal close-and-navigate behavior.

## Security and Accessibility Outcome

- Missing caller scope or a missing owned release yields no Music Queue link.
- The contract excludes provider credentials, source and transfer identifiers,
  file details, and raw candidate data.
- No mutation, CSRF surface, background work, or database migration was added.
- The link has a clear standalone purpose; its relationship to the release is
  expressed in semantic text, not color or proximity alone.

## Next Recommended Item

Show the same app-user-scoped Music Queue handoff in the compact Downloader
table only when it is a useful first-pass destination. Keep it visually
secondary to **Details** and avoid repeating it when the transfer is not
durably linked.
