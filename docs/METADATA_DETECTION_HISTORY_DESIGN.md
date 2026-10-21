# Metadata detection-history ownership design

Date: 2026-10-21. Continues the [command selection outcome](METADATA_COMMAND_SELECTION_OUTCOME.md).
See [official research and tradeoffs](METADATA_DETECTION_HISTORY_RESEARCH_2026_10.md).

Seven controlled tests reproduce old pages/events/cursors, obsolete errors,
incorrect pending cleanup, catalog replacement and pagination during an unfinished
artist load. Resource-ID comparison alone cannot distinguish leaving and returning
to the same artist. Abort alone cannot protect against a dependency that returns
after cancellation.

Extract pagination into `useMetadataDetectionHistory`, a narrow ESM composable
with injected local-artist state, a workspace-token capture function and the
existing read service. It owns page information, page error and pending state.
The artist workflow keeps catalog/navigation ownership and exposes the existing
public refs and load-more method, preserving the view/component contract.

Each page captures the artist ID, cursor, artist generation and a new page-read
generation before dispatch. Pass the page signal to the existing GET adapter.
Require both tokens before appending events, publishing page info or errors, or
clearing pending state. Suppress expected abort errors and reject duplicate clicks
while the current page is pending. Keep current failures retryable at the same
cursor and preserve the server's returned pagination contract.

Reset the history owner before opening/importing an artist, on a failed current
artist open, and whenever an authoritative artist catalog replaces the history.
Reset aborts/invalidates the old page, clears error/pending state and supplies the
new cursor or an exhausted default. This prevents reading the old artist while
the next detail response is pending. Catalog replacement matters even if the
artist generation remains unchanged during a release import's follow-up read.

Keep the authenticated GET contract, bounded server page limit, command authority
and CSRF unchanged. This is client publication ownership, not server authorization
or cancellation of accepted POSTs. Do not add a global pagination framework,
polling, dependency, migration or backend path.

Validate ordinary append and current failure/retry, stale success/rejection,
same-ID reselection, pending ownership, ignored abort, missing workspace and
same-generation catalog replacement. Browser tests use real sessions/HTTP guards
and controlled catalog/page owners, with a held native page response followed by
navigation. Preserve native keyboard controls and a user's focus move. These
checks do not prove live-region announcements or general WCAG conformance.

Retain affected command/cache consumers, run the stable fast gate, and rebuild
preserved local Docker without cache. Keep failed candidates and separate native
guard/UI evidence from durable detection-event store or worker evidence.
