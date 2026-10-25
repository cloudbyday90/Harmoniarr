/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackupArtifactJournalFailure } from '../../src/server/recovery/backup-artifact-failure-policy.js';
import { createControlPlaneRedactionService } from '../../src/server/control-plane-redaction-service.js';

test('journal failures use fixed publish/delete context and preserve recognized codes without reflecting error content', () => {
  for (const operationType of ['publish', 'delete']) {
    const raw = Object.assign(new Error('private-native-message token=secret'), { code: 'EACCES', path: '/retired/private', cause: 'secret' });
    const result = buildBackupArtifactJournalFailure(raw, { operationType });
    assert.equal(result.code, 'EACCES'); assert.match(result.message, /Check folder permissions/u);
    assert.match(result.message, operationType === 'publish' ? /publication/u : /deletion/u);
    assert.doesNotMatch(JSON.stringify(result), /private-native-message|retired|secret/u);
    assert.equal(raw.message, 'private-native-message token=secret');
  }
});

test('unknown journal failures do not reflect vendor/database codes or attacker-controlled operation labels', () => {
  for (const operationType of ['publish', 'delete', '/private-operation']) {
    const result = buildBackupArtifactJournalFailure({ code: '/unsafe-code', message: 'private-message' }, { operationType });
    assert.equal(result.code, 'backup_artifact_file_operation_failed');
    assert.doesNotMatch(JSON.stringify(result), /unsafe-code|private-message|private-operation/u);
  }
  let reads = 0;
  const error = { get code() { return ++reads === 1 ? 'EIO' : '/secret'; } };
  assert.equal(buildBackupArtifactJournalFailure(error, { operationType: 'publish' }).code, 'EIO');
  assert.equal(reads, 1);
});

test('both journal paths are masked by key independently of current configured roots', () => {
  const journal = { id: 'operation-1', operationType: 'publish', status: 'temporary_ready',
    storagePath: '/retired/音乐 Room/backup.json', temporaryPath: '/retired/音乐 Room/.private.partial',
    lastErrorMessage: buildBackupArtifactJournalFailure({ code: 'EIO' }, { operationType: 'publish' }).message };
  const result = createControlPlaneRedactionService({ settings: { paths: { music: '/replacement' } } }).redactValue(journal);
  assert.equal(result.storagePath, '[REDACTED_PATH]'); assert.equal(result.temporaryPath, '[REDACTED_PATH]');
  assert.equal(result.lastErrorMessage, journal.lastErrorMessage); assert.equal(result.status, 'temporary_ready');
  assert.equal(result.id, journal.id); assert.match(journal.temporaryPath, /retired/u);
});
