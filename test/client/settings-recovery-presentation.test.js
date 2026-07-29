/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSettingsRecoveryPosture } from '../../src/client/lib/settings-recovery-presentation.js';

test('recovery posture reports a loading inventory without claiming protection', () => {
  assert.deepEqual(buildSettingsRecoveryPosture({ isLoadingBackups: true }), {
    checks: [],
    message: 'Checking saved backups and recovery state.',
    statusLabel: 'Checking',
    tone: 'info',
  });
});

test('recovery posture makes an unavailable backup read actionable', () => {
  const posture = buildSettingsRecoveryPosture({ backupErrorMessage: 'Request failed' });

  assert.equal(posture.statusLabel, 'Needs attention');
  assert.equal(posture.tone, 'danger');
  assert.match(posture.message, /Refresh/);
});

test('recovery posture identifies an absent backup', () => {
  const posture = buildSettingsRecoveryPosture();

  assert.equal(posture.statusLabel, 'Backup needed');
  assert.equal(posture.checks[0].statusLabel, 'None');
});

test('recovery posture keeps unencrypted backups distinct from protected backups', () => {
  const posture = buildSettingsRecoveryPosture({ backupArtifacts: [{ encrypted: false }] });

  assert.equal(posture.statusLabel, 'Protection review');
  assert.equal(posture.checks[0].statusLabel, 'Not encrypted');
  assert.equal(posture.tone, 'warning');
});

test('recovery posture identifies an encrypted backup with a ready preview', () => {
  const posture = buildSettingsRecoveryPosture({
    backupArtifacts: [{ encrypted: true }],
    selectedBackupPreview: { canApplyRestore: true },
  });

  assert.equal(posture.statusLabel, 'Protected backup available');
  assert.deepEqual(posture.checks, [
    { label: 'Latest backup', statusLabel: 'Encrypted', tone: 'success' },
    { label: 'Restore check', statusLabel: 'Ready', tone: 'success' },
    { label: 'Maintenance', statusLabel: 'Clear', tone: 'success' },
  ]);
});

test('recovery posture prioritizes active maintenance over a ready backup', () => {
  const posture = buildSettingsRecoveryPosture({
    backupArtifacts: [{ encrypted: true }],
    hasActiveLocks: true,
    selectedBackupPreview: { canApplyRestore: true },
  });

  assert.equal(posture.statusLabel, 'Maintenance active');
  assert.equal(posture.checks.at(-1).statusLabel, 'Maintenance active');
});
