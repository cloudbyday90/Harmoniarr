import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRecoverySectionHash,
  defaultRecoverySectionId,
  getRecoveryHoldDescription,
  getRecoveryHoldLabel,
  normalizeRecoverySectionId,
  recoverySectionNavigationItems,
} from '../../src/client/lib/recovery-workspace.js';

test('recovery workspace keeps a stable operator task order', () => {
  assert.deepEqual(
    recoverySectionNavigationItems.map((item) => item.id),
    ['backups', 'restore', 'safety-holds', 'diagnostics'],
  );
});

test('normalizeRecoverySectionId falls back to the default section for unknown values', () => {
  assert.equal(normalizeRecoverySectionId('#restore'), 'restore');
  assert.equal(normalizeRecoverySectionId('diagnostics'), 'diagnostics');
  assert.equal(normalizeRecoverySectionId('#missing'), defaultRecoverySectionId);
  assert.equal(normalizeRecoverySectionId(null), defaultRecoverySectionId);
});

test('buildRecoverySectionHash always returns a valid section hash', () => {
  assert.equal(buildRecoverySectionHash('safety-holds'), '#safety-holds');
  assert.equal(buildRecoverySectionHash('#unknown'), `#${defaultRecoverySectionId}`);
});

test('recovery hold helpers keep lock wording in plain language', () => {
  assert.equal(getRecoveryHoldLabel('maintenance'), 'Safety hold');
  assert.equal(getRecoveryHoldLabel('admin_recovery'), 'Admin recovery hold');
  assert.equal(
    getRecoveryHoldDescription('restore'),
    'Block conflicting activity while you preview or apply a restore.',
  );
});