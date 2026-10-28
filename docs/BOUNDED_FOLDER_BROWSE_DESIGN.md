# Bounded folder browsing design

October 28, 2026. See [research and tradeoffs](BOUNDED_FOLDER_BROWSE_RESEARCH_2026_10.md)
and [outcome](BOUNDED_FOLDER_BROWSE_OUTCOME.md).

The existing administrator filesystem GET remains the only browsing endpoint.
A small route adapter owns authorization, no-store responses and disconnect
cancellation, including a disconnect while authentication is pending. It
delegates to an application-scoped service factory. No external
service, database, migration, maintenance refresh or retained cursor registry is
introduced. The existing filesystem visibility and symlink filtering remain.

Each admitted call streams a directory with bufferSize 32. A bounded sorted page
selector retains at most 100 matching directory names after/before its anchor.
Names use deterministic case-sensitive JavaScript lexical order, replacing the
old locale-dependent case-insensitive full-array sort. Regular files and symlinks
do not become folder buttons but still count against the scan budget. The service
counts total directories and page positions while streaming. Every successful
page reaches EOF and checks directory metadata again. A scan ceiling, timeout,
read/close error or observed metadata change produces an explicit error, never a
partial complete page. Close is awaited on all paths before scan capacity retires.

HMAC cursors bind actor, resolved path and dev/inode/mtime/ctime metadata through
a context digest, plus anchor/direction and expiry. The key lives in the route's
service instance, so restart invalidates old cursors. Invalid, expired, altered,
cross-actor/path or observed changed-directory cursors require Start again.
This metadata comparison detects ordinary changes; it is not an atomic snapshot,
does not prove unchanged contents under every filesystem/ABA condition and grants
no permission. Every page rechecks the administrator session and opens the path.

Admission is immediate refusal above four concurrent calls, with no waiting queue.
The five-second elapsed budget is checked around native operations and sequential
reads. There are at most 50,000 accepted raw entries plus one overflow/EOF probe;
native buffering may read ahead. Slow native I/O cannot be forcibly retired by a
JavaScript deadline, and the capacity slot remains held through actual close.
Path/query/token/name bounds limit input and per-page retained bytes.

The client read owner accepts only bounded page envelopes. Previous/Next replace
the old page and revoke selection while loading or after failure. Retry uses the
same page intent; Start again clears continuation. Page failure cannot select a
cached directory. Persistent controls hand owned focus to the path before their
disabled/entry state changes; completion never steals focus. Successful current
directory selection still changes only the captured Storage draft. The native
dialog lifecycle and explicit save remain unchanged.
