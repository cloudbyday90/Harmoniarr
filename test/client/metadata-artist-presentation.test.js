/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNextMonitoringPatch,
  describeMonitoringDecision,
  describeWantedState,
  detectionEventLinkTarget,
} from '../../src/client/lib/metadata-artist-presentation.js';

// ---------------------------------------------------------------------------
// describeMonitoringDecision
// ---------------------------------------------------------------------------

test('describeMonitoringDecision returns wanted-release label for wanted_release_detected', () => {
  assert.equal(
    describeMonitoringDecision('wanted_release_detected'),
    'A wanted release was detected for this monitoring policy.',
  );
});

test('describeMonitoringDecision returns ignored-type label for ignored_release_type', () => {
  assert.equal(
    describeMonitoringDecision('ignored_release_type'),
    'Release type is not included in the monitoring policy.',
  );
});

test('describeMonitoringDecision returns satisfied label for already_satisfied', () => {
  assert.equal(
    describeMonitoringDecision('already_satisfied'),
    'Catalog already has this release — no action needed.',
  );
});

test('describeMonitoringDecision returns fallback label for unknown decision', () => {
  assert.equal(
    describeMonitoringDecision('something_unknown'),
    'No monitoring action was taken.',
  );
});

test('describeMonitoringDecision returns fallback label for null', () => {
  assert.equal(
    describeMonitoringDecision(null),
    'No monitoring action was taken.',
  );
});

// ---------------------------------------------------------------------------
// describeWantedState
// ---------------------------------------------------------------------------

test('describeWantedState returns Missing for missing status', () => {
  assert.equal(describeWantedState('missing'), 'Missing');
});

test('describeWantedState returns Partial for partial status', () => {
  assert.equal(describeWantedState('partial'), 'Partial');
});

test('describeWantedState returns None for unknown or absent status', () => {
  assert.equal(describeWantedState(null), 'None');
  assert.equal(describeWantedState(undefined), 'None');
  assert.equal(describeWantedState('satisfied'), 'None');
});

// ---------------------------------------------------------------------------
// buildNextMonitoringPatch
// ---------------------------------------------------------------------------

test('buildNextMonitoringPatch toggles isMonitored from true to false', () => {
  const patch = buildNextMonitoringPatch({
    monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album', 'ep'] },
  });
  assert.equal(patch.isMonitored, false);
  assert.deepEqual(patch.monitoredReleaseGroupTypes, ['album', 'ep']);
});

test('buildNextMonitoringPatch toggles isMonitored from false to true', () => {
  const patch = buildNextMonitoringPatch({
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album'] },
  });
  assert.equal(patch.isMonitored, true);
});

test('buildNextMonitoringPatch defaults to album+ep when monitoring is absent', () => {
  const patch = buildNextMonitoringPatch({});
  assert.equal(patch.isMonitored, true);
  assert.deepEqual(patch.monitoredReleaseGroupTypes, ['album', 'ep']);
});

test('buildNextMonitoringPatch preserves custom release group types', () => {
  const patch = buildNextMonitoringPatch({
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['single', 'live'] },
  });
  assert.deepEqual(patch.monitoredReleaseGroupTypes, ['single', 'live']);
});

// ---------------------------------------------------------------------------
// detectionEventLinkTarget
// ---------------------------------------------------------------------------

test('detectionEventLinkTarget returns a link target when artist and release group ids are present', () => {
  const target = detectionEventLinkTarget(
    { artist: { id: 'artist-1' } },
    { metadataReleaseGroupId: 'rg-1' },
  );
  assert.ok(target, 'should return a link target');
  assert.equal(target.label, 'Open release group');
  assert.ok(target.to, 'link target should have a route location');
});

test('detectionEventLinkTarget returns null when release group id is absent', () => {
  const target = detectionEventLinkTarget(
    { artist: { id: 'artist-1' } },
    { metadataReleaseGroupId: '' },
  );
  assert.equal(target, null);
});

test('detectionEventLinkTarget builds a link even when artist id is absent (releaseGroupId alone is sufficient)', () => {
  const target = detectionEventLinkTarget(
    { artist: { id: '' } },
    { metadataReleaseGroupId: 'rg-1' },
  );
  assert.ok(target, 'should return a link target');
  assert.equal(target.label, 'Open release group');
  // artistId absent from query since it is empty
  assert.ok(!target.to.query?.artistId, 'artistId should not appear in query when absent');
});

test('detectionEventLinkTarget builds a link when localArtist has no artist property', () => {
  const target = detectionEventLinkTarget(
    {},
    { metadataReleaseGroupId: 'rg-1' },
  );
  assert.ok(target, 'should return a link target when only releaseGroupId is present');
  assert.equal(target.label, 'Open release group');
});
