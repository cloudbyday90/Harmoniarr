/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFilesystemFailure, isFilesystemFailure } from '../../src/server/filesystem-failure-policy.js';
import { createControlPlaneRedactionService } from '../../src/server/control-plane-redaction-service.js';

test('filesystem failure policy selects fixed messages and guidance by code, never native prose', () => {
  for (const code of ['EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'EDQUOT', 'EROFS', 'ENOTDIR', 'EISDIR', 'EEXIST',
    'EXDEV', 'EIO', 'EBUSY', 'EMFILE', 'ENFILE', 'ELOOP', 'ENAMETOOLONG', 'ENOMEM', 'EFBIG', 'ENOTEMPTY',
    'ETXTBSY', 'ENXIO', 'ENODEV', 'ENOSYS', 'EINVAL']) {
    const error = Object.assign(new Error('private-message token=secret'), { code, path: '/other/private', syscall: 'private-syscall', cause: 'secret' });
    const failure = buildFilesystemFailure(error, { operation: 'backup_payload_read', sourcePath: '/retired/音乐 Room/backup.json' });
    assert.equal(isFilesystemFailure(error), true); assert.equal(failure.code, code);
    assert.equal(failure.operation, 'backup_payload_read'); assert.ok(failure.message.includes(code));
    assert.doesNotMatch(JSON.stringify(failure), /private-message|private-syscall|\/other\/private|secret/u);
    assert.equal(error.message, 'private-message token=secret');
  }
});

test('unrecognized codes and thrown values cannot inject content into fallback descriptors', () => {
  for (const error of [null, 'private', new Error('private'), { code: '/private\r\nsecret' }, { code: 'operation_run_cancelled' }]) {
    assert.equal(isFilesystemFailure(error), false);
    const failure = buildFilesystemFailure(error, { operation: 'backup_payload_read' });
    assert.equal(failure.code, 'filesystem_operation_failed'); assert.doesNotMatch(JSON.stringify(failure), /private|secret|cancelled/u);
  }
  assert.throws(() => buildFilesystemFailure(null, { operation: '/private' }), /Unsupported filesystem failure operation/u);
  let codeReads = 0;
  const changingCode = { get code() { return ++codeReads === 1 ? 'EIO' : '/private-secret'; } };
  assert.equal(buildFilesystemFailure(changingCode, { operation: 'backup_payload_read' }).code, 'EIO');
  assert.equal(codeReads, 1);
});

test('structured path fields are masked by key after roots change while safe explanation and codes survive', () => {
  const failure = buildFilesystemFailure({ code: 'ENOSPC' }, { operation: 'import_file_finalize',
    sourcePath: '/retired/音乐 Room/song.flac', destinationPath: 'Q:/Retired/Artist/song.flac' });
  const redacted = createControlPlaneRedactionService({ settings: { paths: { music: '/replacement' } } }).redactValue({ filesystemFailure: failure });
  assert.equal(redacted.filesystemFailure.message, failure.message);
  assert.equal(redacted.filesystemFailure.code, 'ENOSPC');
  assert.equal(redacted.filesystemFailure.sourcePath, '[REDACTED_PATH]');
  assert.equal(redacted.filesystemFailure.destinationPath, '[REDACTED_PATH]');
  assert.match(failure.sourcePath, /retired/u);
});
