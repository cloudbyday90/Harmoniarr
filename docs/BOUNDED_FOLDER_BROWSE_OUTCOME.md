# Bounded folder browsing outcome

October 28, 2026. See [research](BOUNDED_FOLDER_BROWSE_RESEARCH_2026_10.md) and
[design](BOUNDED_FOLDER_BROWSE_DESIGN.md).

## Implemented result

The existing administrator filesystem GET now delegates to a thin route adapter
and three narrow ESM filesystem modules: bounded page selection, signed cursor
policy and scan orchestration. Shared scalar/page validation serves the client
and server. No external service, dependency, schema or maintenance change is
needed. The route remains administrator-only and now marks every response
no-store. Disconnects during authentication admit no scan; active disconnects
abort the owned scan without releasing capacity ahead of native settlement.

The service streams opendir with bufferSize 32, retains at most 100 sorted folder
candidates and returns at most 100 entries. Raw files and symlinks count toward
the 50,000-entry scan ceiling but do not become folder buttons. Four active calls
are allowed per service instance; excess calls are immediately refused. Capacity
remains held through actual close on success, failure, cancellation and timeout.
A five-second cooperative work budget checks elapsed time around native work.
There is no waiting queue, retained open-directory cursor or expiry timer.

Cursors are HMAC-authenticated, expire after ten minutes and bind the actor,
resolved path, directory dev/inode/mtime/ctime facts, direction and anchor. They
carry navigation state rather than filesystem authority. Every page authorizes
again and scans to EOF under the same limits. Observed metadata changes, invalid
or expired cursors and empty stale continuation are refused with Start again
guidance. Metadata checks do not establish an atomic filesystem snapshot.
Sorting is now deterministic case-sensitive JavaScript lexical order rather
than the previous locale-dependent case-insensitive full-array sort.

The client replaces pages and retains current previous/next cursors plus retry
intent. Selection is revoked during reads and after failures; stale or malformed
pages cannot grant selection. Previous, Next and Start again are explicit native
buttons. The persistent status reports page ranges and refusal; owned focus moves
to the path before replacing controls, and completion preserves later user focus.
The scrollable dialog/list keeps actions reachable at short viewport heights.
Selection remains draft-only and other Storage drafts survive all these actions.

## Executed verification

| Boundary | Final result |
| --- | --- |
| Focused service/selector/API/client/route checks | Passed, including all four route cases for real HTTP composition, current authorization and disconnect ownership; the complete counts below include these checks |
| Complete fast gate | 11,767 passed: server 6,469, client 4,595, scripts 703; zero failed, cancelled or skipped |
| Static/build | All 14 stages passed: Node, copyright, migration/schema/anchor, ESM, image/topology, lint, hygiene, test groups and build |
| Real local filesystem | 207 directories exhaust in exact sorted order, navigate back and refuse continuation after membership changes |
| Resource ownership | Exact ceiling/overflow including non-folders; 100-candidate bound; fifth-call refusal; held read/close cancellation; close failure, primary Error/null preservation and capacity reuse |
| Cursor/protocol | Tampering, actor/path mismatch, restart/expiry, metadata change, query bounds and malformed/oversized client pages refused |
| Final combined browser command | 13 passed, zero failed, cancelled or skipped; folder, prior Storage/zoom and deployment authority regressions |
| Packaged browser | 32 destination/viewport/theme scenes plus eight paging scenes; 205 synthetic folders render as 100/100/5, replace rather than append, navigate backward and restart |
| Browser ownership | Held continuation disables selection; later focus is preserved; changed/oversized listing refusal and recovery preserve every draft; zero forwarded mutations or page errors |
| Actual 400% tab zoom | Chromium reports 3.9999999999999996 (4 within floating-point tolerance), 320x256 CSS viewport; eight destination/theme scenes plus two paging scenes; owned browser/profile retired |
| Actual packaged HTTP | Existing administrator successfully reads a real bounded /data page with no-store; actual settings/secret-status compare equal before/after the synthetic fixture |
| Fresh packaged Linux scanner | 207 directories return 100/100/7; file/symlink exclusion, exact lexical/backward parity, changed-directory refusal, four awaited opens/closes and owned-file/container cleanup |

Final source: 3,871 files, SHA-256
`ace1c7053159f87fbf035c97fd908e4bc36dfd89190e971a5aca3e2db616bedc`.
Seventeen code files were frozen for final qualification. The complete fast
runner uses the 14 validate:fast stages with server concurrency eight. A final
review added the pending-authentication disconnect fence; prior candidate
evidence is retained separately. Final gate/package/browser evidence resides in
`.tmp/bounded-folder-browse-2026-10-28/qualified/`, with the final owned zoom
profile's evidence location recorded in that browser log. Earlier lint/driver
preflight diagnostics are not counted as passing final qualification.

```text
node --test test/server/folder-browse-service.test.js test/server/folder-browse-routes.test.js test/server/folder-page-selector.test.js test/server/system-routes.test.js test/server/system-routes.validation.test.js test/client/use-folder-browser.test.js test/client/system-api.test.js
node --test --test-reporter=tap test/browser/folder-browser-verification.test.js test/browser/settings-authority-route-access.test.js test/browser/storage-labels-browser-verification.test.js test/compatibility/folder-browser-zoom.test.js test/compatibility/storage-labels-zoom.test.js
```

Twelve packaged UI captures and four zoom captures were produced. Six packaged
paging captures and two actual-zoom paging captures were visually inspected in
both themes. Short viewports use vertical scrolling; pagination and selection
actions remain reachable without horizontal clipping. Automated role/status and
focus checks do not prove spoken announcements or physical-device acceptance.
Those manual checks remain deferred at the user's request.

## Packaged outcome and limits

The current walkthrough is healthy at http://127.0.0.1:47956 on image
`sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60`.
The fresh `--pull --no-cache --load` builder retired. Existing administrator and
five bind mounts, loopback-only port, read-only root and Linux x64 UID 1000 were
preserved. Runtime is Node 24.22.1/npm 12.0.2. Startup verified 115 applied
migrations, zero pending and zero newly applied. Bootstrap retired, readiness
passed and the temporary password file was removed.

The final inventory is compared to the original committed image
`sha256:9c9e868f5467f37a5dd84e5e77fb23ba79188e8c5a9947320381197c0321c9df`.
The intermediate local candidate's inventory is preserved separately. Exactly
five server files and the new shared policy differ from that original baseline;
all other server/shared files, 110 dependency packages, 151 OS packages, Node
binary and root package metadata match. Final counts are 1,063 server, 14 shared
and 157 compiled client files. The client matches the local build; 56 compiled
files differ from the original image. Entrypoint identity and an owned data-bind
publication/removal probe passed with cleanup acknowledged.

After reviewing the filesystem-only route/service scope and unchanged worker,
SQL, media, provider and recovery contracts, 157 historical native qualification
groups are retained with exact test/runtime comparisons. Zero fresh historical
native groups are claimed. The affected scanner's fresh Linux probe is separate.
The change establishes application entry/concurrency/work bounds, not a measured
whole-process RSS or throughput improvement. Native prefetch and runtime overhead
remain distinct. Cooperative deadlines cannot interrupt a stalled filesystem
call; its slot stays occupied until actual read/close settlement. Each page
rescans the directory, and exceptionally large listings explicitly refuse rather
than silently truncate. The research document records these tradeoffs.

## PR check and next item

GitHub MCP found zero open repository PRs initially and at final review on
October 28, 2026. Random local PR implementation and stale Dependabot cleanup or
rebasing were inapplicable. All 23 changed files are included directly on main;
no branch, release, tag or PR merge is created.

Local qualification is recorded in the [measurement outcome](FOLDER_BROWSE_PROFILE_OUTCOME.md),
using owned fixtures and separate RSS/heap/container/timing observations. The user
deferred network-storage checks. Local samples do not establish a network-storage
guarantee or justify automatic changes to admission, scan or time limits.
