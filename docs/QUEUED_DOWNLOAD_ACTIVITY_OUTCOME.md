# Explicit queued-download Activity outcome

October 20, 2026. Fixed the defect reproduced by the
[canonical native command prototype](NATIVE_CANONICAL_COMMAND_OUTCOME.md):
Start download emitted music_queue_download_queued, but the real Activity service
rejected it. The database CHECK and client presentation also lacked this type.
See the separate [design](QUEUED_DOWNLOAD_ACTIVITY_DESIGN.md).

The service now admits and filters the existing event. Generated forward-only
migration 20261020_154903_add_missing_music_download_queued_activity.sql retains
all previous allowed values and adds queued preparation. The generated snapshot
contains 109 migrations; table, event column and constraint anchors are included.
Actual unknown-type insertion still fails with PostgreSQL 23514, and source/
snapshot comparison passes all 138 anchors.

Activity renders Download queued as routine download history and preserves this
explicit command as a boundary between automatic milestones. It describes
preparation before provider acceptance; manual match selection describes the
separate Start download action. The queued event exposes the existing canonical
Missing Music link. The first browser prototype showed that its link helper
alone was insufficient: the rendered view suppressed routine-event links. The
view now admits this explicit queued-event link.

Three new fast controls verify producer-to-service admission/feed filtering,
queued presentation/canonical link and explicit timeline boundaries. Adjacent
focused tests passed (46 total). Both actual Activity browser cases passed on
the final code, covering queued text, filter visibility, named link destination
and focus ownership while retaining automatic-story behavior. Their feed is
controlled; they do not prove live command submission or full WCAG coverage.

The native PostgreSQL case awaits the actual optional queued recording result
outside the swallowed-failure callback, then verifies one event per replayed
command through persisted rows and the authenticated filtered feed. Required
command audit and actor/recipient assertions remain separate. Activity stays
best effort in production and cannot fail a committed command.

The [local Docker upgrade](LOCAL_DOCKER_NATIVE_CANONICAL_OUTCOME.md) preserved
existing data/admin and applied the one migration successfully: 109 applied,
0 pending. Final fast gate: 10,616 tests plus lint/static checks/builds. Private
prototype/final evidence remains under .tmp/native-canonical-2026-10-20/.
