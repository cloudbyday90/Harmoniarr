/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import test from 'node:test';
import { createBackupArtifactFileReadinessService } from '../../src/server/recovery/backup-artifact-file-readiness-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';

function fixture({ hook = async () => {}, nonFile = false } = {}) {
  const draft = createBackupArtifactFixture({ storagePath: '/unused/backup.json' });
  const facts = { dev: 1n, ino: 2n, size: BigInt(Buffer.byteLength(draft.content)), mtimeNs: 3n, ctimeNs: 4n, isFile: () => !nonFile };
  let pathFacts = { ...facts }, handleFacts = { ...facts }, content = Buffer.from(draft.content);
  const calls = [];
  const step = async name => { calls.push(name); await hook(name, calls); };
  const service = createBackupArtifactFileReadinessService({
    assertOwnership: () => step('owner'),
    lstatFn: async (_path, options) => { assert.deepEqual(options, { bigint: true }); await step('path-stat'); return { ...pathFacts }; },
    openFn: async (path, flags) => {
      await step('open'); assert.equal(path, draft.artifact.storagePath);
      assert.equal(flags & constants.O_RDWR, constants.O_RDWR);
      assert.equal(flags & (constants.O_CREAT | constants.O_TRUNC | constants.O_APPEND), 0);
      assert.equal(flags & (constants.O_NOFOLLOW ?? 0), constants.O_NOFOLLOW ?? 0);
      return {
        stat: async () => { await step('handle-stat'); return { ...handleFacts }; },
        readFile: async () => { await step('read'); return content; },
        sync: () => step('sync'), close: () => step('close'),
      };
    },
  });
  return { service, calls, input: { artifact: draft.artifact }, draft,
    changePath: patch => { pathFacts = { ...pathFacts, ...patch }; },
    changeHandle: patch => { handleFacts = { ...handleFacts, ...patch }; },
    changeContent: bytes => { content = bytes; },
  };
}

test('recovered file readiness verifies original bytes, syncs once and closes before accepting current identity', async () => {
  const f = fixture();
  const result = await f.service.prepareBackupArtifactFile(f.input);
  assert.equal(result.status, 'verified');
  assert.deepEqual(f.calls, ['owner', 'path-stat', 'owner', 'open', 'handle-stat', 'read', 'owner', 'sync', 'handle-stat', 'close', 'owner', 'path-stat']);
});

test('sync and handle failures keep Error/null/undefined precedence through failed close', async () => {
  for (const stage of ['handle-stat', 'sync']) for (const primary of [Object.freeze(new Error('primary')), null, undefined]) {
    const f = fixture({ hook: async name => { if (name === stage) throw primary; if (name === 'close') throw new Error('secondary'); } });
    await assert.rejects(f.service.prepareBackupArtifactFile(f.input), error => error === primary);
    assert.equal(f.calls.filter(name => name === 'close').length, 1);
    assert.equal(f.calls.at(-1), 'close');
  }
});

test('a close-only failure remains failed and is never retried', async () => {
  for (const failure of [new Error('close failed'), null, undefined]) {
    const f = fixture({ hook: async name => { if (name === 'close') throw failure; } });
    await assert.rejects(f.service.prepareBackupArtifactFile(f.input), error => error === failure);
    assert.equal(f.calls.filter(name => name === 'close').length, 1);
    assert.equal(f.calls.at(-1), 'close');
  }
});

test('missing and non-regular paths are not opened or synced and unsuccessful open owns no handle', async () => {
  for (const stage of ['path-stat', 'open']) {
    const f = fixture({ hook: async name => { if (name === stage) throw Object.assign(new Error('missing'), { code: 'ENOENT' }); } });
    assert.equal((await f.service.prepareBackupArtifactFile(f.input)).status, 'missing');
    assert.ok(!f.calls.includes('close')); assert.ok(!f.calls.includes('sync'));
  }
  const f = fixture({ nonFile: true });
  assert.equal((await f.service.prepareBackupArtifactFile(f.input)).code, 'artifact_path_not_file');
  assert.ok(!f.calls.includes('open'));
  const failure = new Error('denied');
  const denied = fixture({ hook: async name => { if (name === 'open') throw failure; } });
  await assert.rejects(denied.service.prepareBackupArtifactFile(denied.input), error => error === failure);
  assert.ok(!denied.calls.includes('close'));
});

test('same-size corrupt bytes never reach sync and remain a verification failure', async () => {
  const f = fixture();
  const bytes = Buffer.from(f.draft.content); bytes[0] ^= 1; f.changeContent(bytes);
  assert.equal((await f.service.prepareBackupArtifactFile(f.input)).status, 'unverified');
  assert.ok(!f.calls.includes('sync')); assert.equal(f.calls.at(-1), 'close');
});

test('opened identity, in-flight content facts and post-close path changes refuse readiness', async () => {
  for (const moment of ['open', 'sync', 'close']) {
    let f;
    f = fixture({ hook: async name => {
      if (name !== moment) return;
      if (moment === 'open') f.changeHandle({ ino: 5n });
      if (moment === 'sync') f.changeHandle({ mtimeNs: 6n });
      if (moment === 'close') f.changePath({ ino: 7n });
    } });
    assert.equal((await f.service.prepareBackupArtifactFile(f.input)).code, 'artifact_file_identity_changed');
    assert.equal(f.calls.filter(name => name === 'close').length, 1);
    if (moment === 'open') assert.ok(!f.calls.includes('read'));
  }
});

test('a disappeared post-close path cannot become a missing-file abandonment result', async () => {
  let closed = false;
  const f = fixture({ hook: async name => {
    if (name === 'close') closed = true;
    if (name === 'path-stat' && closed) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
  } });
  assert.equal((await f.service.prepareBackupArtifactFile(f.input)).code, 'artifact_file_identity_changed');
});

test('ownership loss before sync or after cleanup cannot accept readiness', async () => {
  for (const lostAt of [2, 3, 4]) {
    let checks = 0; const failure = new Error('owner lost');
    const f = fixture({ hook: async name => { if (name === 'owner' && ++checks === lostAt) throw failure; } });
    await assert.rejects(f.service.prepareBackupArtifactFile(f.input), error => error === failure);
    assert.equal(f.calls.includes('close'), lostAt !== 2);
    assert.equal(f.calls.includes('sync'), lostAt === 4);
  }
});

test('readiness remains unsettled while close is pending', async () => {
  const ready = Promise.withResolvers(), finish = Promise.withResolvers();
  let settled = false;
  const f = fixture({ hook: async name => { if (name === 'close') { ready.resolve(); await finish.promise; } } });
  const task = f.service.prepareBackupArtifactFile(f.input).finally(() => { settled = true; });
  try {
    await Promise.race([ready.promise, task.then(() => { throw new Error('settled before close'); })]);
    assert.equal(settled, false); assert.equal(f.calls.at(-1), 'close');
  } finally { finish.resolve(); await task; }
  assert.equal((await task).status, 'verified');
});
