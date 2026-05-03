import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRecoveryRouteQuery,
  getRecoveryRouteStateKey,
  normalizeRecoveryRouteState,
} from '../../src/client/lib/recovery-route-state.js';

test('normalizeRecoveryRouteState trims selected backup artifact identifiers', () => {
  assert.deepEqual(normalizeRecoveryRouteState({ backupArtifactId: ' backup-22 ' }), {
    backupArtifactId: 'backup-22',
  });
});

test('buildRecoveryRouteQuery omits empty backup artifact identifiers', () => {
  assert.deepEqual(buildRecoveryRouteQuery({ backupArtifactId: 'backup-22' }), {
    backupArtifactId: 'backup-22',
  });
  assert.deepEqual(buildRecoveryRouteQuery({ backupArtifactId: ' ' }), {});
});

test('getRecoveryRouteStateKey matches equivalent normalized route states', () => {
  assert.equal(
    getRecoveryRouteStateKey({ backupArtifactId: ' backup-22 ' }),
    getRecoveryRouteStateKey({ backupArtifactId: 'backup-22' }),
  );
});
