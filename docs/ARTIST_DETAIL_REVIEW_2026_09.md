# Artist detail review and improvement plan

Date: September 12, 2026. Reviewed baseline: `c9772d62a5c4f67b41e5aa2cbf2ebc0d9d542cc6`.

## Purpose and screenshot

Harmoniarr is a Soulseek-native music library manager. Artist detail is the operator's deep-curation surface: monitoring policy, release and track exceptions, ownership, and saved intent that can queue reconciliation. Monitoring is not a download guarantee.

The supplied Lauren Daigle screenshot shows the Sessions (2024) release dialog with `limit must be an integer between 1 and 25`, a blank header strip, and artwork placeholders. The error is confirmed in code: the backend tracklist fallback passes limit 100 into a catalog service whose validator allows at most 25. The client does not supply that invalid limit. Placeholder causes cannot be established from the screenshot alone; neither contrast ratios nor responsiveness can be measured reliably from this resized, dimmed image.

Independent sub-agent reviews covered UI/accessibility and backend contracts; a further review covered frontend state and official guidance. Findings below are actionable code observations, with unmeasured risks explicitly identified. This is not an exhaustive security audit.

## Fifteen prioritized improvements

| # | Priority | Finding and evidence | Recommended change and acceptance criteria |
| --- | --- | --- | --- |
| 1 | P1, fixed | Tracklist fallback requests 100 editions through a 25-item contract. `src/server/metadata/release-group-tracklist-service.js:248`; `musicbrainz-catalog-service.js:154`. | Use a supported 25-item request without relaxing the public validator. Regression tests use the real catalog service for uncached groups and imported groups without editions. See the separate outcome. |
| 2 | P1, fixed | Stale dialog loads can change newer state. `src/client/composables/useReleaseDetail.js:50` aborts prior work, but response/error/finally updates have no request-identity guard; old finally clears current loading. | Add current-request guards, cancellation on disposal, and defined reset behavior. Resolve two requests in reverse order and prove only the latest changes data, errors, or loading. |
| 3 | P1, fixed | Raw dialog error has no Retry action. `src/client/components/media/ReleaseDetailModal.vue:575`. | Add a contextual, announced error and Retry, preserve album identity, and withhold actions that need unavailable data. Verify failed load followed by successful retry without closing. |
| 4 | P1, fixed | Edition display silently stops at six. `ReleaseDetailModal.vue:622` uses `allReleases.slice(0, 6)`. | Provide bounded expansion or an accessible selector for all supplied editions. Test seven-plus editions and selection beyond six. Coordinate with server pagination in item 14. |
| 5 | P1, fixed | Save conflict protection can be omitted. `src/server/metadata/operator-artist-save-service.js:273` skips null revision; `src/server/routes/metadata-routes.js:268` defaults to null. | Require the expected revision, including explicit initial revision. Reject missing/null values; stale concurrent saves must return 409 with no partial writes. Actual lost updates were not reproduced. |
| 6 | P1, fixed | Artist GET can queue reconciliation. `src/server/routes/metadata-routes.js:237`, `src/server/metadata/operator-artist-projection-service.js:189`, and actual module wiring. | Move automatic recovery to the durable worker; keep deliberate recovery on the existing protected POST. Prove repeated GETs create no jobs and worker recovery remains deduplicated. This is a confirmed read/mutation boundary issue, not a demonstrated exploit. |
| 7 | Fixed | Track override numeric and UUID validation now rejects malformed supplied values without coercion. | See [design](TRACK_OVERRIDE_VALIDATION_DESIGN.md) and [outcome](TRACK_OVERRIDE_VALIDATION_OUTCOME.md). |
| 8 | Fixed | Track ownership now exposes real text for confirmed and unmatched library states; decorative circles are hidden from assistive technology. | See [design](TRACK_OWNERSHIP_ACCESSIBILITY_DESIGN.md) and [outcome](TRACK_OWNERSHIP_ACCESSIBILITY_OUTCOME.md). |
| 9 | Fixed | Artwork requests are bounded and successful batches and hero roles survive sibling failures; the modal receives resolved group artwork. | See [design](ARTWORK_RESILIENCE_DESIGN.md) and [outcome](ARTWORK_RESILIENCE_OUTCOME.md). |
| 10 | P2 | Modal references undefined theme tokens, including --hx-bg-muted and --hx-text-danger. `ReleaseDetailModal.vue:922`, `:1345`. | Replace with defined surface/danger/faint/pill tokens. Check computed styles, light/dark rendering, and contrast; no measured WCAG failure is claimed here. |
| 11 | P2 | Header is visually empty and dialog has a generic hidden title. `ReleaseDetailModal.vue:524`, `:533`, `:559`. | Use a visible release heading as the accessible name, with Close alongside it. Test long names, focus containment, Escape, and return focus. |
| 12 | P1, fixed | Request deduplication ignores the recipient. `src/client/composables/useReleaseRequest.js:125` keys requested/in-flight sets only by release. An in-memory reproduction requested for A then B: only A was submitted and B returned success/skipped. | Bind request identity and eligibility to release plus recipient, including current-user semantics. Test sequential and concurrent A/B submissions, retries, and recipient changes in the dialog. |
| 13 | P1, fixed | Delayed artist mutations can replace another artist's projection. `src/client/views/ArtistDetailView.vue:548`, `:576` apply async save/edition results without binding them to the current artist route. | Capture artist identity and route generation before mutation; apply results/errors only to the originating view generation. Test save A, navigate to B, then resolve A. Code path is confirmed; a live navigation reproduction remains needed. |
| 14 | P2 | Detail eagerly loads all groups and editions. `src/server/metadata/metadata-read-service.js:175`; `metadata-repository.js:399`, `:436`. Fallback currently exposes only its first 25 editions. `src/client/composables/useArtistDetail.js:191` also caps remote groups at 100 and discards pagination metadata. | Introduce deterministic discography/edition pagination and explicit completeness metadata; preserve full server-side reconciliation. Benchmark a large catalog and test preferred editions beyond page one. Latency has not been benchmarked in this review. |
| 15 | P2 | Post-save activity, notification, and refresh failures are swallowed. `src/server/metadata/operator-artist-save-service.js:634`, `:637`, `:675`, `:684`. | Preserve committed saves while emitting redacted structured failure evidence. Consider durable outbox delivery for required events. Inject failures and verify visible recovery evidence without falsely reporting save rollback. |

Paths abbreviated after their first occurrence refer to the same directory/component above. Line numbers refer to the reviewed baseline, except the unchanged location of the immediate fix.

## Recommended implementation sequence and tradeoffs

First complete dialog request lifecycle and recovery (items 2-3), together with recipient and route identity (12-13). Next harden save/read boundaries and track identities (5-7), then expose editions and truthful ownership (4, 8). Finish visual consistency (9-11), bounded catalogs, and failure observability (14-15).

Keep Node 24 native ESM, Vue composables, modular service/store factories, PostgreSQL transactions, and existing operation workers. Request identity guards are small and directly testable; a broad state-library migration adds unnecessary risk. Bounded pages protect providers and payload size but need explicit continuation and selected-edition semantics. Durable recovery improves observability but requires careful retry and deduplication design. Preserve artist draft Save/Cancel behavior throughout.

The immediate 25-item repair is deliberately narrow. It removes the invalid call; it does not add live track hydration, complete remote edition pagination, or solve every modal defect.

## Official accessibility guidance

Discovered and opened through research tools on September 12, 2026:

- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): retain the existing native dialog and verify accessible naming, focus containment, Escape, and restoration.
- [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification): use understandable textual explanations. The screenshot is a system-loading failure, not user input that the operator can correct by changing a limit.
- [W3C ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19): announce dynamically introduced errors without relying on color alone.

These guide follow-up acceptance criteria; static source review and the supplied screenshot do not establish accessibility conformance.

Recipient identity implementation and validation are recorded in [RECIPIENT_REQUEST_IDENTITY_OUTCOME.md](RECIPIENT_REQUEST_IDENTITY_OUTCOME.md).

Artist and album response lifecycle implementation is recorded in [ARTIST_ASYNC_LIFECYCLE_OUTCOME.md](ARTIST_ASYNC_LIFECYCLE_OUTCOME.md).

Release-detail error recovery is recorded in [RELEASE_DETAIL_RETRY_OUTCOME.md](RELEASE_DETAIL_RETRY_OUTCOME.md).

Edition selection beyond the first six and remote identity handling are recorded in [RELEASE_EDITION_PICKER_OUTCOME.md](RELEASE_EDITION_PICKER_OUTCOME.md).

Required artist-save revisions and concurrent-save protection are recorded in [ARTIST_SAVE_REVISION_OUTCOME.md](ARTIST_SAVE_REVISION_OUTCOME.md).

Read-only artist projections and durable recovery are recorded in [ARTIST_READ_RECOVERY_OUTCOME.md](ARTIST_READ_RECOVERY_OUTCOME.md).
