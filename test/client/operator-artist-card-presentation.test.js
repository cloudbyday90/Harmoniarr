import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperatorHomeStats,
  calculateOperatorArtistCoveragePercent,
  formatOperatorArtistCoverageLine,
  formatOperatorArtistPolicySummary,
  formatOperatorArtistWantedSummary,
  formatOperatorReleaseTypes,
} from '../../src/client/lib/operator-artist-card-presentation.js';

test('formatOperatorReleaseTypes returns a readable unique release-type list', () => {
  assert.equal(formatOperatorReleaseTypes(['album', 'ep', 'album', 'single']), 'Albums, EPs, & Singles');
  assert.equal(formatOperatorReleaseTypes([]), 'No release types');
});

test('formatOperatorArtistPolicySummary formats compact policy choices', () => {
  assert.equal(formatOperatorArtistPolicySummary({
    acquisitionProfileKey: 'balanced_library',
    monitoredReleaseGroupTypes: ['album', 'ep'],
    releaseScope: 'future_only',
  }), 'Albums & EPs · Future releases · Balanced');
});

test('formatOperatorArtistWantedSummary formats wanted automation choices', () => {
  assert.equal(formatOperatorArtistWantedSummary({
    wantedAutomationMode: 'future_matching',
  }), 'Future wanted');
});

test('calculateOperatorArtistCoveragePercent clamps acquired count to desired count', () => {
  assert.equal(calculateOperatorArtistCoveragePercent({
    acquiredReleaseCount: 3,
    desiredReleaseCount: 2,
  }), 100);
  assert.equal(calculateOperatorArtistCoveragePercent({
    acquiredReleaseCount: 1,
    desiredReleaseCount: 4,
  }), 25);
  assert.equal(calculateOperatorArtistCoveragePercent({}), 0);
});

test('formatOperatorArtistCoverageLine summarizes acquired and gap counts', () => {
  assert.equal(formatOperatorArtistCoverageLine({
    acquiredReleaseCount: 2,
    desiredReleaseCount: 5,
    missingReleaseCount: 2,
    partialReleaseCount: 1,
    unresolvedReleaseCount: 1,
  }), '2 of 5 desired releases acquired · 1 partial · 2 missing · 1 unresolved');
  assert.equal(formatOperatorArtistCoverageLine({ desiredReleaseCount: 0 }), 'No desired releases selected yet');
});

test('buildOperatorHomeStats derives monitored profile dashboard cards', () => {
  const stats = buildOperatorHomeStats([
    {
      operator: {
        coverage: {
          acquiredReleaseCount: 2,
          desiredReleaseCount: 4,
        },
        overview: {
          reviewNeededTrackOverrideCount: 0,
        },
        reconciliation: {
          status: 'completed',
        },
      },
    },
    {
      operator: {
        coverage: {
          acquiredReleaseCount: 1,
          desiredReleaseCount: 2,
        },
        overview: {
          reviewNeededTrackOverrideCount: 1,
        },
        reconciliation: {
          status: 'failed',
        },
      },
    },
  ]);

  assert.deepEqual(stats.map((stat) => stat.value), ['2', '6', '3', '1']);
  assert.equal(stats[2].meta, '50% of desired releases');
});
