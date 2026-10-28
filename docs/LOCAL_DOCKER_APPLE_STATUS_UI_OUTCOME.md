# Apple saved-status UI Docker qualification outcome

October 28, 2026. See the separate [qualification design](LOCAL_DOCKER_APPLE_STATUS_UI_DESIGN.md),
[implementation outcome](APPLE_STATUS_UI_OUTCOME.md) and
[official research/tradeoffs](APPLE_STATUS_UI_RESEARCH_2026_10.md).

## Frozen source and packaged parity

Frozen source: 3,804 files,
`2a7f343d551ae60bcdf29ba27139af6179c81f344ad3e9eae56e271695e2dfe4`.
Ten code/test/helper files were fixed before the final fourteen-stage gate. It
passed 6,402 server, 4,512 client and 703 script/policy tests: 11,617 total,
with no failures, skips or cancellations. Lint, ESM, copyright, migration/snapshot/
anchor, image/compose checks, test hygiene and build passed. Production dependency
audit found zero vulnerabilities.

Fresh pull/no-cache BuildKit image:
`sha256:478590cadb1a2bed1dd4354e486877f6b5a6e4c374aa9dd86966b4e3c3f02ef1`.
Against the [preceding status image](LOCAL_DOCKER_APPLE_STATUS_OUTCOME.md), all
server/shared bytes, 110 npm package records, 151 OS package records, the Node
binary and root package metadata are unchanged. Counts remain 1,055 server,
156 client and 13 shared files. All packaged client bytes match the local build;
56 entries in the new client are new or changed relative to the preceding path/
hash inventory, including bundle/import hash churn. That count does not include
removed old hashed paths or mean 56 directly edited source files.

Runtime remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and bundled Undici 7.30.1.
Vue is 3.5.44; browser qualification used installed Playwright 1.64.1 and Chromium
156.0.8078.4. The fresh builder was removed and absence checked.

The read-only UID-1000 walkthrough is healthy on loopback 47956. Existing
administrator and all five inspected bind sources, including the actual downloads
override, were preserved. Readiness passed; bootstrap helper and temporary password
file retired. Startup applied zero migrations and verified 115 applied, zero
pending. No manual schema refresh or extra deployed app is required.

## Executed browser evidence

The explicit repository browser test passed one real-app scenario containing eight
groups without skips or cancellations, using the existing isolated PostgreSQL/app/
Chromium harness. The same shared scenario then passed against the immutable
walkthrough client. Status/save responses are controlled for UI states; the two
Settings PUT responses are fulfilled by the fixture and never reach the operator
settings endpoint. Unrelated Soulseek status is controlled. This does not establish
new encrypted persistence or live provider acceptance.

The eight groups cover:

- Persistent polite/atomic status outside busy ancestors and duplicate keyboard
  activation while the initial status read is held. Refresh focus survives completion.
- Invalid and incomplete saved-field descriptions, distinct from presence/source.
- Bounded failure without raw server text, followed by focused retry and recovery.
- Draft ID, key and clear changes without status requests, with a saved-only notice
  and no invalid marking on the different current draft input.
- Failed save preserving draft ID/key and the existing save error while saved
  status refreshes.
- A held read invalidated by save, read/refresh guards during the held save, and
  refreshed saved state after acknowledgment with the write-only key draft cleared.
- Navigation away/back retiring the old view and loading current state.
- Light/dark desktop (1440), tablet (800) and mobile (390) layout, no region/page
  overflow, and a refresh target at least 44 CSS pixels high.

Each shared scenario observed ten controlled status GETs with no body/query and
two controlled PUTs. No unexpected page error occurred. Six controlled screenshots
and two actual-result screenshots were reviewed. Actual authenticated no-store
status GET returned incomplete for this walkthrough; after fixture removal and
reload, the built UI rendered its missing saved values correctly. Exact ordinary
settings and secret-status snapshots before/after the browser work match, so the
operator's configuration was preserved.

Focused tests separately establish the 15-second deadline, ignored-abort late
success/failure protection, scope disposal and malformed-response refusal. Browser
abort/result invalidation establishes client lifetime behavior, not actual server
database cancellation/drainage. Automated role/focus/DOM checks do not prove spoken
announcements, physical-device behavior or full WCAG conformance; those manual
checks remain deferred.

## Retained behavior, failures and limits

Existing login, one automatic no-store schema diagnostic read, 164 current anchors,
preserved focus and mobile no-overflow passed. Packaged entrypoint bytes/mode match
source and baseline. The data-bind probe passed private directory creation/sync,
exclusive publication/collision and cleanup checks and removed its owned files.

Backend Apple status/save/signing/HTTPS, other provider/OAuth/Plex/session/KDF and
media/artwork qualification is retained after exact source/test/package/runtime
comparison. Those unchanged native matrices were not rerun. The previous unexplained
linked-login failure remains separate in the [provider HTTP outcome](LOCAL_DOCKER_PROVIDER_HTTP_OUTCOME.md),
without diagnosis or repair here. No deployment memory minimum or live Apple
acceptance is claimed.

Initial browser-helper lint found undeclared browser globals in callbacks; explicit
globalThis corrected them. The first browser run then failed on a fixture selector
expecting Retry save instead of the existing Try saving again label. These failed
records are retained separately; product behavior was not weakened, and only the
later passing preflight/final checks count as qualification.

GitHub MCP found zero open PRs initially and at the final check; PR application and
stale Dependabot cleanup/rebase were inapplicable. No release workflow, tag,
registry publication, PR merge or separate application branch was used. Private
evidence in `.tmp/apple-status-ui-2026-10-28/` includes source/code manifests,
gate records, exact inventories, browser logs/results, reviewed screenshots,
bind/entrypoint probes, PR checks and final commit/push verification. The next item
is bounded provider-status aggregation as detailed in the
[implementation outcome](APPLE_STATUS_UI_OUTCOME.md).
