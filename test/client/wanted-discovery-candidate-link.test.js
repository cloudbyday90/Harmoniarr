/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWantedDiscoveryCandidateLocation,
  getWantedDiscoveryCandidateSearchId,
  hasWantedDiscoveryCandidates,
} from '../../src/client/lib/wanted-discovery-candidate-link.js';

function buildRelease(overrides = {}) {
  return {
    discoveryRequest: {
      evidence: {
        lastSearchId: ' search-discovery-1 ',
        lastSearchResult: {
          candidateCount: 2,
          fileCount: 12,
          sourceProvider: 'slskd',
        },
      },
    },
    ...overrides,
  };
}

test('buildWantedDiscoveryCandidateLocation returns null when discovery evidence is absent', () => {
  assert.equal(buildWantedDiscoveryCandidateLocation({ discoveryRequest: null }), null);
  assert.equal(hasWantedDiscoveryCandidates({ discoveryRequest: null }), false);
});

test('buildWantedDiscoveryCandidateLocation returns null when no candidates were found', () => {
  const release = buildRelease({
    discoveryRequest: {
      evidence: {
        lastSearchId: 'search-discovery-1',
        lastSearchResult: {
          candidateCount: 0,
        },
      },
    },
  });

  assert.equal(buildWantedDiscoveryCandidateLocation(release), null);
  assert.equal(hasWantedDiscoveryCandidates(release), false);
});

test('buildWantedDiscoveryCandidateLocation returns null when the source search id is missing', () => {
  const release = buildRelease({
    discoveryRequest: {
      evidence: {
        lastSearchId: ' ',
        lastSearchResult: {
          candidateCount: 1,
        },
      },
    },
  });

  assert.equal(buildWantedDiscoveryCandidateLocation(release), null);
  assert.equal(hasWantedDiscoveryCandidates(release), false);
});

test('buildWantedDiscoveryCandidateLocation builds a sanitized match-diagnostics route', () => {
  const release = buildRelease();

  assert.equal(getWantedDiscoveryCandidateSearchId(release), 'search-discovery-1');
  assert.equal(hasWantedDiscoveryCandidates(release), true);
  assert.deepEqual(buildWantedDiscoveryCandidateLocation(release), {
    hash: '#import-review-selection-stage',
    name: 'activity-diagnostics-matches',
    query: {
      sourceSearchId: 'search-discovery-1',
      status: 'all',
    },
  });
});

test('buildWantedDiscoveryCandidateLocation only forwards route-safe filter keys', () => {
  const release = buildRelease({
    discoveryRequest: {
      evidence: {
        apiKey: 'secret-should-not-route',
        lastSearchId: 'search-secret-test',
        lastSearchQuery: 'private search terms',
        lastSearchResult: {
          candidateCount: 1,
        },
      },
    },
  });

  assert.deepEqual(Object.keys(buildWantedDiscoveryCandidateLocation(release).query).sort(), [
    'sourceSearchId',
    'status',
  ]);
});
