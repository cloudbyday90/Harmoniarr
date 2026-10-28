# Apple status UI Docker qualification design

October 28, 2026. See [UI design](APPLE_STATUS_UI_DESIGN.md) and
the separate [Docker outcome](LOCAL_DOCKER_APPLE_STATUS_UI_OUTCOME.md).

Freeze source after focused checks; run one complete fast gate and build a fresh
pull/no-cache image with a disposable BuildKit builder. Compare exact packaged
server/shared, client build, dependencies, OS packages and Node binary against
the preceding status image. Client asset hashes may churn after a Vue build;
verify the entire new client matches the local build rather than counting only
direct imports as changed assets.

Preserve the walkthrough administrator, five bind sources, read-only UID-1000 and
loopback 47956. Verify readiness, current schema/migration state, entrypoint/data-
bind cleanup and existing login. Run the new actual-app browser scenario against
the built client, intercepting only the identified status/save and unrelated health
responses for controlled states. No test writes operator settings. Separately
read the actual authenticated no-store status endpoint and render its result.

Review Chromium desktop/tablet/mobile and light/dark screenshots, keyboard retry
focus, unchanged draft values, no raw-error echo and no overflow. Retain earlier
backend status/save/signing/OAuth/media proof after exact source/test/runtime
comparison; this UI patch does not requalify every native matrix. Browser abort
means client lifetime retirement, not PostgreSQL drainage. No new app, manual
schema refresh, release, live Apple, memory minimum or manual AT/device approval.
Private evidence stays under `.tmp/apple-status-ui-2026-10-28/`.
