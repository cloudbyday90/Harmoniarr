/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupArtifactFailureRecorder } from '../../src/server/recovery/backup-artifact-failure-recorder.js';
import { createBackupArtifactFileOperationService } from '../../src/server/recovery/backup-artifact-file-operation-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';

const operation = { id: '8c66b836-ad59-42d0-886c-8990733c3940', operationType: 'publish' };
const primaryError = Object.freeze(Object.assign(new Error('/private/file token=secret'), { code: 'EIO' }));
const ownerLost = Object.assign(new Error('private SQL and password=secret'), { code: 'backup_artifact_owner_lost' });

test('failure recording writes only bounded error fields and reports nothing after an acknowledged record', async () => {
  const writes = [];
  const recorder = createBackupArtifactFailureRecorder({
    recordFileOperationFailure: async input => { writes.push(input); return { id: operation.id }; },
    onJournalFailure: () => { assert.fail('unexpected secondary report'); },
  });
  assert.equal(await recorder.recordFailure(primaryError, operation), true);
  assert.deepEqual(Object.keys(writes[0]).sort(), ['fileOperationId', 'lastErrorCode', 'lastErrorMessage']);
  assert.equal(writes[0].lastErrorCode, 'EIO');
  assert.doesNotMatch(JSON.stringify(writes), /private|secret/u);
});

test('primary values survive the secondary Error/null and failing-reporter matrix without mutation or disclosure', async () => {
  for (const primary of [primaryError, null, undefined, 'opaque private primary']) {
    for (const secondary of [ownerLost, null]) {
      for (const reporterFailure of [false, new Error('private reporter'), null]) {
        const reports = [];
        const recorder = createBackupArtifactFailureRecorder({
          recordFileOperationFailure: async () => { throw secondary; },
          onJournalFailure: async diagnostic => {
            reports.push(diagnostic);
            if (reporterFailure !== false) throw reporterFailure;
          },
        });
        assert.equal(await recorder.recordFailure(primary, operation), false);
        assert.equal(reports.length, 1);
        assert.equal(reports[0].primaryCode, primary === primaryError ? 'EIO' : 'backup_artifact_file_operation_failed');
        assert.equal(reports[0].journalFailure, secondary === ownerLost ? 'owner_lost' : 'write_failed');
        assert.doesNotMatch(JSON.stringify(reports), /private|secret|SQL|reporter/u);
      }
    }
  }
  assert.equal(Object.isFrozen(primaryError), true);
  assert.equal(Object.hasOwn(primaryError, 'cause'), false);
});

test('recording and secondary reporting both settle before the failure recorder returns', async () => {
  const record = Promise.withResolvers();
  const report = Promise.withResolvers();
  const reportReady = Promise.withResolvers();
  let settled = false;
  const recorder = createBackupArtifactFailureRecorder({
    recordFileOperationFailure: () => record.promise,
    onJournalFailure: async () => { reportReady.resolve(); await report.promise; },
  });
  const task = recorder.recordFailure(primaryError, operation).then(value => { settled = true; return value; });
  try {
    assert.equal(settled, false);
    record.reject(ownerLost);
    await reportReady.promise;
    assert.equal(settled, false);
  } finally {
    report.resolve();
    await task;
  }
  assert.equal(await task, false);
});

test('a missing journal row cannot be acknowledged as a recorded failure', async () => {
  const reports = [];
  const recorder = createBackupArtifactFailureRecorder({ recordFileOperationFailure: async () => null, onJournalFailure: value => { reports.push(value); } });
  assert.equal(await recorder.recordFailure(primaryError, operation), false);
  assert.equal(reports[0].journalFailure, 'record_missing');
});

test('default runtime diagnostic excludes unvalidated references and raw errors', async t => {
  const output = [];
  t.mock.method(process.stderr, 'write', chunk => { output.push(String(chunk)); return true; });
  const recorder = createBackupArtifactFailureRecorder({ recordFileOperationFailure: async () => { throw ownerLost; } });
  assert.equal(await recorder.recordFailure(primaryError, { id: '/private/name\ninjected', operationType: 'unsafe\ntype' }), false);
  assert.equal(output.length, 1);
  assert.match(output[0], /"fileOperationId":null/u);
  assert.match(output[0], /"operationType":"unknown"/u);
  assert.doesNotMatch(output[0], /private|secret|unsafe|injected|SQL/u);
  assert.equal(output[0].split('\n').length, 2);
});

test('publish, delete and recovery rethrow the original Error/null after secondary journal failure', async () => {
  for (const method of ['publishBackupArtifact', 'deleteBackupArtifact', 'recoverIncompleteFileOperations']) {
    for (const primary of [primaryError, null, undefined]) {
      const draft = createBackupArtifactFixture({ storagePath: '/unused/backup.json' });
      const reports = [];
      let mutations = 0;
      let fileCalls = 0;
      const fail = async () => { fileCalls++; throw primary; };
      const row = { ...operation, artifactSnapshot: draft.artifact, operationType: 'delete', status: 'prepared' };
      const service = createBackupArtifactFileOperationService({
        backupArtifactFileService: { writePrivateTemporaryFile: fail, removeFileIfPresent: fail },
        backupArtifactFileVerificationService: { verifyBackupArtifactFile: async () => ({ status: 'verified' }) },
        createFileOperation: async () => row,
        listIncompleteFileOperations: async () => [row, { ...row, id: 'second-operation' }],
        updateFileOperation: async () => { mutations++; },
        recordFileOperationFailure: async () => { throw ownerLost; },
        onJournalFailure: value => { reports.push(value); },
      });
      await assert.rejects(service[method]({ ...draft, artifact: draft.artifact }), error => error === primary);
      assert.equal(reports.length, 1);
      assert.equal(fileCalls, 1);
      assert.equal(mutations, 0);
    }
  }
});
