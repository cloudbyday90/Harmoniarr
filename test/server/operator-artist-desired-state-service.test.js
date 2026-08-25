import assert from 'node:assert/strict';
import test from 'node:test';

import { createOperatorArtistDesiredStateService } from '../../src/server/metadata/operator-artist-desired-state-service.js';

test('buildDesiredStatePlan distinguishes eligible releases from duplicate-aware blockers', () => {
  const service = createOperatorArtistDesiredStateService({
    getNow: () => new Date('2026-05-25T12:00:00.000Z'),
  });

  const plan = service.buildDesiredStatePlan({
    activeRequestsByReleaseId: new Map([
      ['release-active', { id: 'request-1' }],
    ]),
    discoveryRequestsByReleaseId: new Map([
      ['release-cooldown', { requestStatus: 'cooldown' }],
      ['release-queued', { requestStatus: 'ready' }],
    ]),
    monitoring: {
      isMonitored: true,
      releaseScope: 'future_only',
      wantedAutomationMode: 'future_matching',
    },
    releaseGroups: [{
      id: 'rg-eligible',
      title: 'Future Album',
      operatorState: {
        isExplicitSelection: false,
        resolvedRelease: {
          id: 'release-eligible',
          releaseDate: '2026-06-01',
          title: 'Future Album',
        },
        selectionState: 'selected',
        trackOverrideSummary: { totalCount: 0 },
      },
    }, {
      id: 'rg-complete',
      title: 'Owned Album',
      operatorState: {
        isExplicitSelection: false,
        resolvedRelease: {
          id: 'release-complete',
          releaseDate: '2026-06-02',
          title: 'Owned Album',
        },
        selectionState: 'selected',
        trackOverrideSummary: { totalCount: 0 },
      },
    }, {
      id: 'rg-active',
      title: 'Queued Album',
      operatorState: {
        isExplicitSelection: false,
        resolvedRelease: {
          id: 'release-active',
          releaseDate: '2026-06-03',
          title: 'Queued Album',
        },
        selectionState: 'selected',
        trackOverrideSummary: { totalCount: 0 },
      },
    }, {
      id: 'rg-cooldown',
      title: 'Cooldown Album',
      operatorState: {
        isExplicitSelection: false,
        resolvedRelease: {
          id: 'release-cooldown',
          releaseDate: '2026-06-04',
          title: 'Cooldown Album',
        },
        selectionState: 'selected',
        trackOverrideSummary: { totalCount: 0 },
      },
    }, {
      id: 'rg-queued',
      title: 'Queued Discovery',
      operatorState: {
        isExplicitSelection: false,
        resolvedRelease: {
          id: 'release-queued',
          releaseDate: '2026-06-05',
          title: 'Queued Discovery',
        },
        selectionState: 'selected',
        trackOverrideSummary: { totalCount: 0 },
      },
    }, {
      id: 'rg-manual',
      title: 'Manual Historical Album',
      operatorState: {
        isExplicitSelection: true,
        resolvedRelease: {
          id: 'release-manual',
          releaseDate: '2026-04-01',
          title: 'Manual Historical Album',
        },
        selectionOrigin: 'manual_inclusion',
        selectionState: 'partial',
        trackOverrideSummary: { totalCount: 2 },
      },
    }],
    releaseReconciliationsByReleaseId: new Map([
      ['release-complete', { reconciliationStatus: 'complete' }],
    ]),
  });

  assert.equal(plan.summary.desiredReleaseCount, 6);
  assert.equal(plan.summary.eligibleReleaseCount, 2);
  assert.equal(plan.summary.completeBlockedCount, 1);
  assert.equal(plan.summary.activeRequestBlockedCount, 1);
  assert.equal(plan.summary.cooldownBlockedCount, 1);
  assert.equal(plan.summary.queuedDiscoveryCount, 1);
  assert.equal(plan.summary.explicitDesiredReleaseCount, 1);
  assert.equal(plan.summary.partialDesiredReleaseCount, 1);
  assert.equal(plan.summary.policyDesiredReleaseCount, 5);
  assert.equal(plan.summary.futureEligibleCount, 1);
  assert.equal(plan.summary.currentAndFutureEligibleCount, 1);
  assert.equal(
    plan.desiredReleases.find((release) => release.metadataReleaseId === 'release-manual')?.eligibleForDownstreamWork,
    true,
  );
  assert.equal(
    plan.desiredReleases.find((release) => release.metadataReleaseId === 'release-manual')?.selectionOrigin,
    'manual_inclusion',
  );
});
