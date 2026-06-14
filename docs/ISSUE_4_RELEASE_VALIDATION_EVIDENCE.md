# Issue #4 Release Validation Evidence Map

Source plan: [docs/issue-4-implementation-plan.md](issue-4-implementation-plan.md)

This generated map links every shipped Issue #4 platform step to focused automated tests, browser scenarios, schema evidence, and remaining release evidence work. It is intentionally release-facing: use it to decide what proof must be archived before Issue #4 is closed for a packaged runtime.

## Validation Gates

| Command | Purpose |
| --- | --- |
| `npm test` | Repository-wide lint, hygiene, server, client, script, and integration confidence. |
| `npm run build` | Client and server build confidence before packaging or release evidence capture. |
| `npm run db:check-schema` | Authoritative schema snapshot and fresh-install schema agreement. |
| `npm run test:browser` | Native Playwright browser coverage for requester and operator paths. |
| `npm run validate:release-evidence-pack` | Packaged-runtime Docker evidence pack, with optional released-image, upgrade, and browser-smoke proof. |

## Official Sources Used

- [GitHub Actions workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data) - Release evidence should be archived as workflow artifacts so test, smoke, and deployment proof survives the job log.
- [Node.js test runner](https://nodejs.org/api/test.html) - Focused script validation uses ESM-compatible node:test suites invoked with node --test.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) - High-risk visual surfaces should use committed screenshots from a stable runner environment when visual drift matters.
- [Docker build attestations](https://docs.docker.com/build/metadata/attestations/) - Packaged-runtime release evidence should retain image provenance and SBOM context with the release artifact set.

## Evidence By Step

## Step 1 - Navigation and shell

Focused tests:
- `test/client/app-shell-presentation.test.js`
- `test/server/route-inventory.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`
- `test/browser/issue-4-visual-evidence.test.js`

Schema evidence:
- No schema change; covered by migration and schema gates.

Release evidence tasks:
- Capture role-specific navigation proof in the browser evidence pack.
- Confirm requester-restricted route inventory remains fail-closed.

Remaining release gap: Native visual evidence is covered; archive the generated screenshots as release artifacts before final sign-off.

## Step 2 - Requester home page

Focused tests:
- `test/client/useMonitoredArtistSummaries.test.js`
- `test/client/useRequesterHome-swr.test.js`
- `test/client/app-shell-presentation.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`
- `test/browser/issue-4-visual-evidence.test.js`

Schema evidence:
- No schema change; projection behavior is covered by service and client tests.

Release evidence tasks:
- Capture requester Home cold-start and populated grid paths in packaged browser evidence.
- Archive Home smoke evidence with the release evidence pack.

Remaining release gap: Native populated requester Home visual evidence is covered; archive the generated screenshot with release evidence.

## Step 3 - Discover screen

Focused tests:
- `test/client/discover-graph.test.js`
- `test/client/discover-presentation.test.js`
- `test/client/useDiscoverGraph.test.js`
- `test/client/useDiscoverSearch.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`
- `test/browser/issue-4-visual-evidence.test.js`

Schema evidence:
- No schema change; monitored-artist persistence is covered by existing metadata gates.

Release evidence tasks:
- Capture Discover search, add-to-monitored-artists, and recommendation states in browser evidence.
- Confirm recommendation empty/error states remain readable on mobile.

Remaining release gap: Native visual evidence is covered; archive the generated Discover recommendation screenshot in release evidence.

## Step 4 - External similarity service integration

Focused tests:
- `test/server/similar-artists-service.test.js`
- `test/server/similar-artists-fallback-service.test.js`
- `test/server/listenbrainz-client.test.js`
- `test/server/musicbrainz-client.test.js`
- `test/server/metadata-routes.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- No schema change.

Release evidence tasks:
- Verify graceful empty recommendations when external providers return unavailable or sparse data.
- Retain provider behavior evidence in route and service tests.

Remaining release gap: Add one packaged-runtime provider-degraded smoke note if external provider behavior changes near release.

## Step 5 - Artwork infrastructure

Focused tests:
- `test/client/release-artwork-resolve.test.js`
- `test/server/artwork-fetch-service.test.js`
- `test/server/artwork-ingestion-service.test.js`
- `test/server/artwork-routes.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- Artwork asset schema is covered by migration replay and schema snapshot gates.

Release evidence tasks:
- Capture artwork fallback behavior in browser evidence for artist and release cards.
- Preserve artwork route and ingestion tests as focused release proof.

Remaining release gap: Add visual evidence for placeholder, remote CAA, and local artwork card states.

## Step 6 - My Requests screen

Focused tests:
- `test/client/my-requests-presentation.test.js`
- `test/client/request-status.test.js`
- `test/client/useMyRequests.test.js`
- `test/integration/library-media-requests.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- Media request schema is covered by migration replay and schema snapshot gates.

Release evidence tasks:
- Capture requester My Requests list, empty state, and cancellation visibility.
- Include delegated request visibility in packaged-runtime smoke evidence.

Remaining release gap: Add packaged browser proof for requester-only My Requests navigation.

## Step 7 - Search screen

Focused tests:
- `test/client/search-api.test.js`
- `test/client/search-presentation.test.js`
- `test/client/useGlobalSearch.test.js`
- `test/client/useSearchMusicWorkflow.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- No schema change.

Release evidence tasks:
- Capture MusicBrainz and network search mode behavior in browser evidence.
- Confirm release request modal opens from search results.

Remaining release gap: Add visual evidence for search result cards across both modes.

## Step 8 - Missing and wanted screen

Focused tests:
- `test/client/wanted-release-normalization.test.js`
- `test/client/useLibraryWantedReleases.test.js`
- `test/server/library-wanted-release-service.test.js`
- `test/server/library-wanted-release-store.test.js`

Browser scenarios:
- `test/browser/library-grid-state.test.js`
- `test/browser/issue-4-visual-evidence.test.js`

Schema evidence:
- Wanted release joins are covered by schema snapshot and migration replay gates.

Release evidence tasks:
- Capture Missing/Wanted filter states and request action behavior in browser evidence.
- Retain wanted status normalization tests as focused proof.

Remaining release gap: Native Needs Attention visual evidence is covered; archive the generated screenshot in release evidence.

## Step 9 - Multi-user awareness pass

Focused tests:
- `test/client/media-request-api.test.js`
- `test/client/useRequestUsers.test.js`
- `test/integration/library-media-requests.test.js`
- `test/server/library-media-request-service.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- requested_for_user_id lineage is covered by migration replay and schema snapshot gates.

Release evidence tasks:
- Keep delegated request journey in packaged-runtime evidence.
- Verify requester and operator scoped reads through native integration coverage.

Remaining release gap: Add release-pack evidence that links one delegated request from creation through fulfillment projection.

## Step 10 - Responsive and mobile

Focused tests:
- `test/client/app-shell-presentation.test.js`
- `test/client/useTabbarOverflow.test.js`
- `test/client/grid-controls-contract.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`
- `test/browser/library-grid-state.test.js`
- `test/browser/issue-4-visual-evidence.test.js`

Schema evidence:
- No schema change.

Release evidence tasks:
- Run browser smoke at desktop and mobile viewport sizes before release sign-off.
- Capture responsive navigation and grid behavior in visual evidence.

Remaining release gap: Native mobile-navigation and media-grid visual evidence is covered; packaged-runtime visual capture remains release evidence work.

## Step 11 - Release Radar

Focused tests:
- `test/client/release-radar-normalization.test.js`
- `test/client/useReleaseRadar.test.js`
- `test/server/library-release-radar-service.test.js`
- `test/server/library-release-radar-store.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- Release radar read model is covered by schema snapshot and migration replay gates.

Release evidence tasks:
- Capture Release Radar strip and full-page states in browser evidence.
- Confirm recent/upcoming split with deterministic service tests.

Remaining release gap: Add browser visual proof for Release Radar empty, recent, and upcoming states.

## Step 12 - Activity feed

Focused tests:
- `test/client/activity-event-normalization.test.js`
- `test/client/activity-feed-presentation.test.js`
- `test/client/useActivityFeed.test.js`
- `test/integration/activity-feed-drillthrough.test.js`
- `test/server/activity-event-service.test.js`
- `test/server/activity-routes.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- activity_events migration is covered by migration replay and schema snapshot gates.

Release evidence tasks:
- Capture Activity feed rendering and link drillthrough in browser evidence.
- Keep activity event creation and route tests as focused proof.

Remaining release gap: Add packaged browser proof for requester Home recent Activity panel.

## Step 13 - Cross-user deduplication

Focused tests:
- `test/server/media-request-dedup.test.js`
- `test/server/library-media-request-service.test.js`
- `test/server/library-media-request-fulfillment-service.test.js`
- `test/integration/library-media-requests.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- Cross-user dedup migration is covered by migration replay and schema snapshot gates.

Release evidence tasks:
- Retain cross-user duplicate request coverage in native integration tests.
- Capture linked request visibility in packaged-runtime evidence.

Remaining release gap: Add release-pack proof that a linked request fulfills from the primary request evidence.

## Step 14 - Coming Soon pre-request date-gating

Focused tests:
- `test/client/release-normalization.test.js`
- `test/client/request-status.test.js`
- `test/server/library-media-request-service.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- expected_release_date migration is covered by migration replay and schema snapshot gates.

Release evidence tasks:
- Capture Coming Soon request pills in My Requests evidence.
- Verify future-date request payload handling through server service tests.

Remaining release gap: Add a deterministic browser scenario for an upcoming release card.

## Step 15 - Per-user format and quality preferences

Focused tests:
- `test/client/account-preferences-api.test.js`
- `test/client/useAccountPreferences.test.js`
- `test/server/format-preference-scoring.test.js`
- `test/server/app-user-preferences-routes.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- user_preferences JSONB persistence is covered by migration and schema gates.

Release evidence tasks:
- Capture account preference controls in browser evidence.
- Confirm format preference scoring remains deterministic.

Remaining release gap: Add packaged-runtime proof that saved preferences influence a queued request search.

## Step 16 - Download result scoring

Focused tests:
- `test/server/download-result-scoring.test.js`
- `test/server/import-candidate-service.test.js`
- `test/server/import-candidate-repository.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- Candidate normalized payload ordering is covered by schema snapshot and migration gates.

Release evidence tasks:
- Keep candidate ordering tests as focused proof for scored results.
- Capture import review best-candidate ordering in operator browser evidence.

Remaining release gap: Add release evidence that records scored import candidates from a packaged runtime smoke.

## Step 17 - PWA and push notifications

Focused tests:
- `test/scripts/pwa-manifest.test.js`
- `test/client/pwa-cache-policy.test.js`
- `test/client/pwa-registration.test.js`
- `test/client/usePushNotifications.test.js`
- `test/server/push-notification-service.test.js`
- `test/server/push-routes.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- push_subscriptions migration is covered by migration replay and schema snapshot gates.

Release evidence tasks:
- Verify manifest and service worker assets are present in built client output.
- Capture push subscription route behavior through focused route tests.

Remaining release gap: Add manual release note evidence for mobile install and notification permission flow.

## Step 18 - Artist detail page

Focused tests:
- `test/client/artist-detail-route.test.js`
- `test/client/artist-detail-presentation.test.js`
- `test/client/useArtistDetail.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- No new schema beyond monitored metadata tables already covered by schema gates.

Release evidence tasks:
- Capture artist detail navigation from Home, Discover, and Search in browser evidence.
- Verify discography grouping and related artist behavior with focused client tests.

Remaining release gap: Add visual evidence for artist detail header, discography, and related artists strip.

## Step 19 - Rich release detail modal

Focused tests:
- `test/client/useActiveUsers.test.js`
- `test/client/useReleaseDetail.test.js`
- `test/server/metadata/canonical-release-service.test.js`
- `test/server/metadata/release-group-tracklist-service.test.js`
- `test/server/metadata-routes.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- is_canonical migration and unique index are covered by schema snapshot gates.

Release evidence tasks:
- Capture release detail modal open, edition switching, and request action flow.
- Retain canonical edition route coverage as focused proof.

Remaining release gap: Add visual evidence for release detail modal on mobile and desktop.

## Step 20 - Library view

Focused tests:
- `test/client/library-api.test.js`
- `test/client/library-display-preference.test.js`
- `test/client/library-release-normalization.test.js`
- `test/client/useLibraryReleases.test.js`
- `test/server/library-releases-service.test.js`

Browser scenarios:
- `test/browser/library-grid-state.test.js`
- `test/browser/issue-4-visual-evidence.test.js`

Schema evidence:
- Library reconciliation schema is covered by schema snapshot and migration replay gates.

Release evidence tasks:
- Capture Library grid/list mode, dynamic filters, and clear-all behavior in browser evidence.
- Archive Library display-mode proof in packaged-runtime visual evidence.

Remaining release gap: Native grid/list visual evidence is covered; package the generated screenshots with release evidence.

## Step 21 - Album art color extraction

Focused tests:
- `test/client/artwork-color-worker-client.test.js`
- `test/client/useArtworkColor.test.js`
- `test/server/artwork-dominant-color-service.test.js`
- `test/server/artwork-ingestion-service.test.js`

Browser scenarios:
- `test/browser/library-grid-state.test.js`
- `test/browser/issue-4-visual-evidence.test.js`

Schema evidence:
- Artwork dominant color storage is covered by schema snapshot gates.

Release evidence tasks:
- Capture card accent behavior in visual evidence where artwork is present.
- Verify dominant-color writeback route remains CSRF-protected.

Remaining release gap: Add visual evidence that accent color remains subtle in both themes.

## Step 22 - Rich empty states

Focused tests:
- `test/client/discover-presentation.test.js`
- `test/client/my-requests-presentation.test.js`
- `test/client/search-presentation.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- No schema change.

Release evidence tasks:
- Capture empty states for Discover, Search, Home, and My Requests.
- Confirm CTAs route to the intended requester surfaces.

Remaining release gap: Add visual screenshot proof for cold-start requester flows.

## Step 23 - Global toast system

Focused tests:
- `test/client/useArtistMonitoring.test.js`
- `test/client/useReleaseRequest.test.js`
- `test/client/app-shell-presentation.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- No schema change.

Release evidence tasks:
- Capture success, info, and error toast placement in browser evidence.
- Verify action composables still emit toasts without promising acquisition.

Remaining release gap: Add explicit browser proof for toast stacking near mobile bottom navigation.

## Step 24 - Filter and sort controls on card grids

Focused tests:
- `test/client/grid-controls-contract.test.js`
- `test/client/useGridState.test.js`
- `test/client/useLibraryFilterOptions.test.js`

Browser scenarios:
- `test/browser/library-grid-state.test.js`

Schema evidence:
- No schema change.

Release evidence tasks:
- Capture deep-link filter and sort persistence in browser evidence.
- Verify clear-all preserves unrelated query params.

Remaining release gap: Native Library filter/display visual evidence is covered; add focused filter-panel overflow screenshots if release review calls for them.

## Step 25 - System-aware dark and light theme

Focused tests:
- `test/client/theme-preference.test.js`
- `test/client/useTheme.test.js`
- `test/server/app-user-preferences-routes.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- Theme preference storage uses user_preferences covered by schema gates.

Release evidence tasks:
- Capture dark, light, and system theme behavior in browser evidence.
- Verify persisted preference contract through user preferences routes.

Remaining release gap: Add visual evidence for theme contrast on artwork-heavy views.

## Step 26 - Operator dashboard

Focused tests:
- `test/client/operator-notifications-presentation.test.js`
- `test/client/useOperatorDashboard-swr.test.js`
- `test/server/operator-notification-service.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- Operator projection and notification schema is covered by migration and schema gates.

Release evidence tasks:
- Capture operator dashboard request queue and notification strip in browser evidence.
- Verify requester/operator dashboard split remains role-scoped.

Remaining release gap: Add packaged-runtime proof for operator dashboard after delegated request creation.

## Step 27 - Target-user inbox and notification visibility

Focused tests:
- `test/client/media-request-api.test.js`
- `test/client/useMyRequestNotifications.test.js`
- `test/integration/library-media-requests.test.js`
- `test/server/library-media-request-notification-service.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- Uses existing media request and notification state covered by schema gates.

Release evidence tasks:
- Keep target-user inbox summary covered in native integration tests.
- Capture My Requests nav badge and notification panel in browser evidence.

Remaining release gap: Add packaged-runtime browser proof for requester notification badge behavior.

## Step 28 - Release Radar and Coming Soon full page

Focused tests:
- `test/client/release-radar-normalization.test.js`
- `test/client/useReleaseRadar.test.js`
- `test/server/library-release-radar-service.test.js`
- `test/server/library-release-radar-store.test.js`
- `test/server/library-routes.test.js`
- `test/server/library-wanted-release-service.test.js`
- `test/server/library-wanted-summary-store.test.js`

Browser scenarios:
- `test/browser/operator-ui-smoke.test.js`

Schema evidence:
- No new schema beyond existing metadata release groups and monitoring tables.

Release evidence tasks:
- Capture full Release Radar page recent and upcoming sections in browser evidence.
- Retain route tests for recent/upcoming payload shape.

Remaining release gap: Add visual evidence for the full-page Release Radar and Coming Soon state.
