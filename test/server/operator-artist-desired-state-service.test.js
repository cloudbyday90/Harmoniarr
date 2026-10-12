import assert from 'node:assert/strict';
import test from 'node:test';

import { createOperatorArtistDesiredStateService } from '../../src/server/metadata/operator-artist-desired-state-service.js';

function policyReleaseGroup(operatorState = {}) {
  return { id: 'group', title: 'Album', operatorState: {
    isExplicitSelection: false,
    resolvedRelease: { id: 'release', releaseDate: '2099-10-01', title: 'Album' },
    selectionState: 'selected', trackOverrideSummary: { totalCount: 0 },
    ...operatorState,
  } };
}

for (const isMonitored of [false, undefined, null, 'true', 1]) {
  test(`policy automation requires positive monitoring, refusing ${String(isMonitored)}`, () => {
    const plan = createOperatorArtistDesiredStateService().buildDesiredStatePlan({
      monitoring: { isMonitored, releaseScope: 'future_only', wantedAutomationMode: 'future_matching' },
      releaseGroups: [policyReleaseGroup()],
    });
    assert.equal(plan.desiredReleases[0].eligibleForDownstreamWork, false);
    assert.equal(plan.desiredReleases[0].blockReason, 'artist_unmonitored');
    assert.equal(plan.summary.unmonitoredBlockedCount, 1);
    assert.equal(plan.summary.eligibleReleaseCount, 0);
    assert.equal(plan.summary.policyDesiredReleaseCount, 1);
  });
}

test('default monitoring policy blocks automation while positive monitoring permits it', () => {
  const service = createOperatorArtistDesiredStateService();
  const input = { releaseGroups: [policyReleaseGroup()] };
  const defaultPlan = service.buildDesiredStatePlan(input);
  assert.equal(defaultPlan.desiredReleases[0].blockReason, 'artist_unmonitored');
  const monitoredPlan = service.buildDesiredStatePlan({ ...input, monitoring: {
    isMonitored: true, releaseScope: 'future_only', wantedAutomationMode: 'future_matching',
  } });
  assert.equal(monitoredPlan.desiredReleases[0].eligibleForDownstreamWork, true);
  assert.equal(monitoredPlan.summary.unmonitoredBlockedCount, 0);
});

for (const operatorState of [
  { isExplicitSelection: true, selectionState: 'selected', selectionOrigin: 'manual_inclusion' },
  { isExplicitSelection: true, selectionState: 'partial', selectionOrigin: 'manual_inclusion' },
  { selectionState: 'partial', trackOverrideSummary: { totalCount: 1, resolvedDesiredCount: 1 } },
]) {
  test(`explicit ${operatorState.selectionState} intent retains its broad-policy exception (${operatorState.isExplicitSelection ? 'release' : 'track override'})`, () => {
    const plan = createOperatorArtistDesiredStateService().buildDesiredStatePlan({
      monitoring: { isMonitored: false, releaseScope: 'track_only', wantedAutomationMode: 'manual_only' },
      releaseGroups: [policyReleaseGroup(operatorState)],
    });
    assert.equal(plan.desiredReleases[0].eligibleForDownstreamWork, true);
    assert.equal(plan.desiredReleases[0].isExplicitSelection, true);
    assert.equal(plan.summary.explicitDesiredReleaseCount, 1);
    assert.equal(plan.summary.unmonitoredBlockedCount, 0);
    assert.equal(plan.summary.policyDesiredReleaseCount, 0);
  });
}

for (const [blockReason, input] of [
  ['resolved_release_missing', { releaseGroups: [policyReleaseGroup({ resolvedRelease: null })] }],
  ['already_complete', { releaseReconciliationsByReleaseId: new Map([['release', { reconciliationStatus: 'complete' }]]) }],
  ['already_duplicate', { releaseReconciliationsByReleaseId: new Map([['release', { reconciliationStatus: 'duplicate' }]]) }],
  ['active_request_exists', { activeRequestsByReleaseId: new Map([['release', { id: 'request' }]]) }],
  ['cooldown_active', { discoveryRequestsByReleaseId: new Map([['release', { requestStatus: 'cooldown' }]]) }],
  ['discovery_request_exists', { discoveryRequestsByReleaseId: new Map([['release', { requestStatus: 'ready' }]]) }],
  ['discovery_request_exists', { discoveryRequestsByReleaseId: new Map([['release', { requestStatus: 'blocked' }]]) }],
]) {
  test(`unmonitored policy preserves the existing ${blockReason} blocker`, () => {
    const plan = createOperatorArtistDesiredStateService().buildDesiredStatePlan({
      monitoring: { isMonitored: false }, releaseGroups: [policyReleaseGroup()], ...input,
    });
    assert.equal(plan.desiredReleases[0].eligibleForDownstreamWork, false);
    assert.equal(plan.desiredReleases[0].blockReason, blockReason);
    assert.equal(plan.summary.unmonitoredBlockedCount, 0);
  });
}

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
