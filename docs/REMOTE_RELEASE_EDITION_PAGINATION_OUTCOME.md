# Remote release edition pagination outcome

## Delivered behavior

The release dialog can explicitly browse editions beyond the first 25, including when its local catalog is incomplete. Each activation requests at most 25 editions through the existing authenticated endpoint. The client advances by the raw response length, including short pages, rather than by the requested limit or deduplicated count.

A dedicated ESM composable owns continuation, cancellation, validation, and merging. Failed or malformed pages preserve existing editions and the retry offset. Preview changes cancel pending continuation while retaining the same group's inventory; closing or changing groups clears it. Remote and local representations merge by MusicBrainz identity, preserving available local IDs. Native picker identity remains stable when an edition becomes local.

The backend resolves a preferred remote edition directly when it is absent from the first page or local catalog. It validates the returned release identity and release-group membership instead of silently substituting the first or canonical edition. The selected off-page release is separate from first-page pagination rows. Browsing does not save an operator choice or request acquisition. The existing tracklist fallback's background metadata import remains unchanged.

## Accessibility and security

The native continuation button supports keyboard activation, retains focus at the end of traversal, and guards repeated or disabled activation. A persistent status reports loaded editions; errors provide an explicit retry. Loaded counts do not assert a complete catalog under changing provider data. Existing dialog focus trapping, draft Save/Cancel boundaries, authenticated reads, provider transport, and mutation protections remain in place.

The client validates group identity, offsets, bounded page length, edition identifiers, and nonnegative safe-integer totals before appending. Invalid or unknown totals offer retry instead of inventing completion. A read-only preview cannot bypass backend release membership validation.

## Validation and deployment

Focused backend validation passed 57 tests covering provider lookup, tracklist behavior, catalog behavior, and route projection. Client paging tests passed 12 tests, including invalid responses, raw short-page offsets, retry, deduplication, cancellation, disposal, and remote-to-local preview transitions. API forwarding and stable picker identity have focused regression coverage.

Nine browser tests passed across edition selection, modal behavior, and retry. The new scenario loads 25, fails/retries the next page, reaches 50 then 52, previews edition 52, retains selection and terminal focus, suppresses duplicate activation, and ignores a late response after close/reopen. These provider responses are controlled fixtures, not live MusicBrainz acceptance evidence.

`npm run validate` passed: repository policy checks, lint, 3,466 server tests, 4,287 client tests, 500 script tests, 145 integration tests (8,398 total), and both client/server builds. Separate `npm run validate:security` passed with zero reported vulnerabilities. Browser verification ran the edition-selector, release-detail modal, and release-detail retry suites (9 tests total).

Docker was rebuilt following LOCAL_DOCKER_WALKTHROUGH.md, preserving the existing configuration and data. Image `sha256:85f2b3df61c012f7c0ec405aa47687f3da2c510fda7cc515645fec38e3e7c557` is healthy; bootstrap completed successfully. Live `/healthz` returned 200 and an unauthenticated edition continuation request returned 401.

## Recommendation and limits

Keep the existing authenticated provider routes and transport, the small edition lookup policy, the tracklist service, the isolated continuation composable, and the native picker. Explicit paging bounds each request but requires user activations; direct selected-edition lookup avoids scanning intervening pages but adds a provider read. No cache, new singleton, schema migration, or dependency is required.

Provider offset pagination remains a live view, so rows can overlap or counts can change. Remote fallback still presents edition metadata without newly implementing live remote track hydration. Further performance work should follow representative measurement.

Next address artist post-save failure observability: preserve committed saves while emitting redacted structured evidence for failed activity, notification, and refresh follow-ups. Test safe recovery without repeating the save or falsely reporting a rollback. See the [design, alternatives, official September 2026 sources, and PR disposition](REMOTE_RELEASE_EDITION_PAGINATION_DESIGN.md).
