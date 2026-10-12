/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperatorArtistEffectiveReleaseGroups } from '../../src/server/metadata/operator-artist-effective-state.js';
import { createOperatorArtistDesiredStateService } from '../../src/server/metadata/operator-artist-desired-state-service.js';

function prepare({ trackOverrides = [], releaseGroupSelections = [], releases, monitoring = {} } = {}) {
  const effective = buildOperatorArtistEffectiveReleaseGroups({
    releaseGroups: [{ id: 'group', primaryType: 'album', title: 'Album' }],
    releases: releases ?? [{ id: 'release', releaseGroupId: 'group', isCanonical: true,
      title: 'Album', releaseDate: '1994-11-07' }],
    monitoredReleaseGroupTypes: ['album'], trackOverrides, releaseGroupSelections,
    trackCatalog: [{ metadataReleaseId: 'release', metadataTrackId: 'track', recordingMbid: 'recording',
      mediumPosition: 1, trackPosition: 1, title: 'Track', lengthMs: 300000 }],
  });
  const plan = createOperatorArtistDesiredStateService().buildDesiredStatePlan({
    releaseGroups: effective.effectiveReleaseGroups,
    monitoring: { isMonitored: true, releaseScope: 'track_only', wantedAutomationMode: 'manual_only', ...monitoring },
  });
  return { plan, state: effective.effectiveReleaseGroups[0].operatorState };
}

const cases = [
  { name: 'suppression', isDesired: false, remapStatus: 'resolved', count: 0 },
  { name: 'desired review', isDesired: true, remapStatus: 'review_needed', count: 0 },
  { name: 'desired orphan', isDesired: true, remapStatus: 'orphaned', count: 0 },
  { name: 'unknown remap', isDesired: true, remapStatus: 'unexpected', count: 0 },
  { name: 'absent remap', isDesired: true, count: 0 },
  { name: 'non-boolean desire', isDesired: 'true', remapStatus: 'resolved', count: 0 },
  { name: 'resolved desired current edition', isDesired: true, remapStatus: 'resolved', metadataReleaseId: 'release', count: 1 },
  { name: 'resolved desired group scope', isDesired: true, remapStatus: 'resolved', metadataReleaseId: null, count: 1 },
  { name: 'resolved desired absent binding', isDesired: true, remapStatus: 'resolved', count: 1 },
  { name: 'resolved desired other edition', isDesired: true, remapStatus: 'resolved', metadataReleaseId: 'other', count: 0 },
];

for (const { name, count, ...override } of cases) {
  test(`${name} derives ${count ? 'positive' : 'no'} acquisition consent`, () => {
    const { plan, state } = prepare({ trackOverrides: [{ recordingMbid: 'recording', mediumPosition: 1,
      trackPosition: 1, ...override, metadataReleaseGroupId: 'group' }] });
    assert.equal(state.trackOverrideSummary.totalCount, 1);
    assert.equal(state.trackOverrideSummary.resolvedDesiredCount, count);
    assert.equal(plan.desiredReleases[0].isExplicitSelection, count === 1);
    assert.equal(plan.desiredReleases[0].eligibleForDownstreamWork, count === 1);
    assert.equal(plan.summary.explicitDesiredReleaseCount, count);
    assert.equal(plan.summary.trackOnlyBlockedCount + plan.summary.trackScopeBlockedCount, count === 1 ? 0 : 1);
  });
}

test('mixed suppression and desired review cannot manufacture resolved desire', () => {
  const { plan, state } = prepare({ trackOverrides: [
    { metadataReleaseGroupId: 'group', isDesired: false, remapStatus: 'resolved' },
    { metadataReleaseGroupId: 'group', isDesired: true, remapStatus: 'review_needed' },
  ] });
  assert.deepEqual(state.trackOverrideSummary, { desiredCount: 1, suppressedCount: 1,
    reviewNeededCount: 1, orphanedCount: 0, totalCount: 2, resolvedDesiredCount: 0 });
  assert.equal(plan.summary.eligibleReleaseCount, 0);
});

test('an incomplete desired set remains blocked despite one verified resolved track', () => {
  const { plan, state } = prepare({ trackOverrides: [
    { metadataReleaseGroupId: 'group', isDesired: true, remapStatus: 'resolved', metadataReleaseId: 'release',
      recordingMbid: 'recording', mediumPosition: 1, trackPosition: 1 },
    { metadataReleaseGroupId: 'group', isDesired: false, remapStatus: 'resolved' },
    { metadataReleaseGroupId: 'group', isDesired: true, remapStatus: 'orphaned' },
  ] });
  assert.equal(state.trackOverrideSummary.desiredCount, 2);
  assert.equal(state.trackOverrideSummary.resolvedDesiredCount, 1);
  assert.equal(state.trackOverrideSummary.suppressedCount, 1);
  assert.equal(state.trackOverrideSummary.orphanedCount, 1);
  assert.equal(plan.summary.eligibleReleaseCount, 0);
  assert.equal(plan.summary.trackScopeBlockedCount, 1);
});

test('no resolved edition cannot grant track consent', () => {
  const { plan, state } = prepare({ releases: [], trackOverrides: [
    { metadataReleaseGroupId: 'group', isDesired: true, remapStatus: 'resolved' },
  ] });
  assert.equal(state.trackOverrideSummary.resolvedDesiredCount, 0);
  assert.equal(plan.desiredReleases[0].blockReason, 'resolved_release_missing');
  assert.equal(plan.desiredReleases[0].isExplicitSelection, false);
});

for (const selectionState of ['selected', 'partial', 'unselected']) {
  test(`manual ${selectionState} release intent stays independent of suppression`, () => {
    const { plan } = prepare({ releaseGroupSelections: [
      { metadataReleaseGroupId: 'group', resolvedMetadataReleaseId: 'release', selectionState,
        selectionSource: 'manual', selectionOrigin: 'manual_inclusion' },
    ], trackOverrides: [{ metadataReleaseGroupId: 'group', isDesired: false, remapStatus: 'resolved' }] });
    if (selectionState === 'unselected') assert.deepEqual(plan.desiredReleases, []);
    else {
      assert.equal(plan.desiredReleases[0].isExplicitSelection, true);
      assert.equal(plan.desiredReleases[0].eligibleForDownstreamWork, selectionState !== 'partial');
      assert.equal(plan.desiredReleases[0].selectionOrigin, 'manual_inclusion');
    }
  });
}

for (const count of [undefined, 0, -1, 0.5, '1', NaN, Infinity]) {
  test(`legacy/malformed consent count ${String(count)} cannot grant a policy exception`, () => {
    const { state } = prepare();
    const plan = createOperatorArtistDesiredStateService().buildDesiredStatePlan({
      monitoring: { isMonitored: false },
      releaseGroups: [{ id: 'group', operatorState: { ...state,
        trackOverrideSummary: { totalCount: 1, desiredCount: 1, resolvedDesiredCount: count } } }],
    });
    assert.equal(plan.desiredReleases[0].isExplicitSelection, false);
    assert.equal(plan.desiredReleases[0].blockReason, 'artist_unmonitored');
  });
}

test('suppression preserves ordinary broad-policy eligibility without claiming explicit consent', () => {
  const { plan } = prepare({ monitoring: { releaseScope: 'current_and_future',
    wantedAutomationMode: 'current_and_future_matching' }, trackOverrides: [
    { metadataReleaseGroupId: 'group', isDesired: false, remapStatus: 'resolved' },
  ] });
  assert.equal(plan.desiredReleases[0].eligibleForDownstreamWork, true);
  assert.equal(plan.desiredReleases[0].isExplicitSelection, false);
  assert.equal(plan.summary.policyDesiredReleaseCount, 1);
});

for (const [monitoring, blockReason] of [
  [{ releaseScope: 'current_and_future', wantedAutomationMode: 'manual_only' }, 'manual_only'],
  [{ releaseScope: 'future_only', wantedAutomationMode: 'current_and_future_matching' }, 'future_scope_only'],
  [{ releaseScope: 'current_and_future', wantedAutomationMode: 'future_matching' }, 'future_automation_only'],
  [{ isMonitored: false }, 'artist_unmonitored'],
]) {
  test(`only resolved desired intent retains the ${blockReason} exception`, () => {
    for (const isDesired of [false, true]) {
      const { plan } = prepare({ monitoring, trackOverrides: [
        { metadataReleaseGroupId: 'group', metadataReleaseId: 'release', isDesired, remapStatus: 'resolved',
          recordingMbid: 'recording', mediumPosition: 1, trackPosition: 1 },
      ] });
      assert.equal(plan.desiredReleases[0].eligibleForDownstreamWork, isDesired);
      assert.equal(plan.desiredReleases[0].blockReason, isDesired ? null : blockReason);
    }
  });
}
