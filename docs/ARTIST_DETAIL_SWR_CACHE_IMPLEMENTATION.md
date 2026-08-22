# Artist Detail SWR Cache Implementation

Status: Implemented and validated
Date: 2026-08-22
Owner: Metadata architecture + web platform

## Purpose

This document is the implementation record for the first Artist Detail SWR
recommendation: a persistent, secure, modular cache for normalized public
discography and related-artist provider responses.

## Design Boundary

The implementation is deliberately split into small ES modules:

- cache policy: determines `miss`, `fresh`, `stale`, and `expired` from a
  timestamp and declared policy;
- cache store: PostgreSQL reads, atomic UPSERTs, and retention pruning only;
- cache service: stale-while-revalidate orchestration and refresh coalescing;
- catalog and related-artist services: provider-specific normalization and
  cache-key construction;
- metadata module: dependency construction and wiring.

The cache persists normalized public provider results. It does not replace
canonical imported metadata, provider snapshot provenance, artwork assets, or
authenticated API response caching.

## Intended Behaviour

| Cache state | Request result | Provider work |
| --- | --- | --- |
| miss | Fetch, persist, return | Foreground, coalesced |
| fresh | Return cached payload | None |
| stale | Return cached payload | One background refresh per key |
| expired | Fetch, persist, return | Foreground, coalesced |
| stale refresh error | Return last valid stale payload | Error is observed; cache remains valid until expiry |

## Security Outcome

- The database table has a uniqueness constraint around cache namespace and
  cache key (the provider is an application-defined namespace prefix), plus
  JSON-object payload validation.
- SQL is parameterized in the store; provider values are not interpolated.
- Cache data is public normalized provider metadata only; it contains no
  session, user, secret, or authorization-derived data.
- Existing service-worker API network-only behaviour remains unchanged.

## Files Changed

- `src/server/migrations/20260822_121456_metadata_provider_response_cache.sql`
  creates the dedicated response-cache table and fetched-at index.
- `src/server/metadata/metadata-provider-cache-policy.js` defines the
  response-family freshness windows and cache-state classifier.
- `src/server/metadata/metadata-provider-response-cache-store.js` provides
  parameterized PostgreSQL reads, atomic UPSERTs, and explicit pruning.
- `src/server/metadata/metadata-provider-cache-service.js` implements SWR and
  single-process refresh coalescing.
- `musicbrainz-catalog-service.js`, `similar-artists-service.js`, and
  `metadata-module.js` construct stable cache identities and wire the service
  into Artist Detail's remote data sources.
- The migration snapshot, database model, and critical schema anchors now
  cover the cache table.
- Focused policy, store, service, catalog, related-artist, and module tests
  cover cache state, failures, identity separation, coalescing, and wiring.

## Validation Outcome

- `npm ci` completed with zero audit vulnerabilities. Three package lifecycle
  scripts remained blocked because they are not allow-listed; this update did
  not widen that supply-chain trust boundary.
- `npm run check:schema-anchors` passed with the source database and snapshot
  bootstrap in agreement (83 anchors).
- `npm run validate` passed: copyright, migration, schema snapshot, native
  ESM, image-tag, lint, test-hygiene, full unit/client/script/integration test,
  and production-build checks.

The validation shell supplied Node 24.18.1, so npm correctly warned that it is
below the repository's supported Node 25.4 range. The toolchain policy was not
relaxed to hide that mismatch.
