# Artist release-dialog fallback fix outcome

Date: September 12, 2026.

## Design and result

The Sessions dialog failure originates in the server fallback, which requested 100 release editions from the MusicBrainz catalog service. Its existing public validator accepts at most 25. Changed the internal request to 25 and preserved the validator. No schema, credentials, or UI behavior was changed; all new test code uses native ESM.

Two regression cases cross the real tracklist/catalog-service boundary while replacing only PostgreSQL access and the external provider client. They cover a group absent locally and a local group with no editions. Both previously encountered the invalid-limit contract and now return normalized release metadata.

This is a bounded first-page fix. It does not fetch every remote edition, hydrate missing tracks, change the background import lifecycle, or implement the remaining review findings. Those limitations are explicit in the [15-item review](ARTIST_DETAIL_REVIEW_2026_09.md).

## Validation

- `node --test test/server/metadata/release-group-tracklist-service.test.js`: 9 passed.
- `npm run test:server`: 3,428 passed; zero failures or skips.
- Scoped ESLint for both changed JavaScript files: passed.
- `npm run build:server`: passed.
- Documented walkthrough build, up with health wait, and one-shot bootstrap: passed. Admin already exists; data retained.
- Rebuilt local image: `sha256:49a10613c9cc6a2f5efaa58d0147c52a79bc5a2132aa45d227357ccf87f2e597`.
- Container healthy at `http://127.0.0.1:47956`; `/healthz` returned HTTP 200.

The rebuilt image contains the fix. No live Sessions provider response or browser interaction was asserted; provider availability and missing artwork remain distinct from the corrected contract. No release or registry publication was performed.

## Next step

Implement guarded dialog load/save lifecycles and recipient-aware request identity with deferred-response regression tests, then add contextual Retry. Preserve current artist draft Save/Cancel boundaries and existing native dialog semantics. The review records the evidence and acceptance criteria for all 15 improvements.
