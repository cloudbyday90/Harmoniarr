/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import test from 'node:test';
import { createBackupArtifactDirectorySyncService } from '../../src/server/recovery/backup-artifact-directory-sync-service.js';

function fixture({ hook = async () => {} } = {}) {
  const initial = { dev: 1n, ino: 2n, isDirectory: () => true };
  let pathFacts = { ...initial }, handleFacts = { ...initial };
  const calls = [];
  const step = async name => { calls.push(name); await hook(name, calls); };
  const service = createBackupArtifactDirectorySyncService({
    assertOwnership: () => step('owner'),
    lstatFn: async (path, options) => { assert.equal(path, '/unused'); assert.deepEqual(options, { bigint: true }); await step('path-stat'); return pathFacts; },
    openFn: async (path, flags) => {
      await step('open'); assert.equal(path, '/unused');
      assert.equal(flags & (constants.O_CREAT | constants.O_TRUNC | constants.O_WRONLY | constants.O_RDWR), 0);
      for (const flag of [constants.O_DIRECTORY, constants.O_NOFOLLOW]) if (flag) assert.equal(flags & flag, flag);
      return {
        stat: async () => { await step('handle-stat'); return handleFacts; },
        sync: () => step('sync'), close: () => step('close'),
      };
    },
  });
  return { service, calls, changePath: patch => { pathFacts = { ...pathFacts, ...patch }; },
    changeHandle: patch => { handleFacts = { ...handleFacts, ...patch }; } };
}
const input = { storagePath: '/unused/backup.json' };

test('directory checkpoint owns read-only existing parent sync and one close before identity acceptance', async () => {
  const f = fixture(); await f.service.syncParentDirectory(input);
  assert.deepEqual(f.calls, ['owner','path-stat','owner','open','handle-stat','owner','sync','close','owner','path-stat']);
});

test('directory work Error/null/undefined wins over failed close without a retry', async () => {
  for (const stage of ['handle-stat','sync']) for (const primary of [Object.freeze(new Error('primary')),null,undefined]) {
    const f = fixture({ hook: async name => { if (name === stage) throw primary; if (name === 'close') throw new Error('secondary'); } });
    await assert.rejects(f.service.syncParentDirectory(input), error => error === primary);
    assert.equal(f.calls.filter(name => name === 'close').length, 1); assert.equal(f.calls.at(-1), 'close');
  }
});

test('unsupported sync and close-only rejections remain failures with no fallback', async () => {
  for (const [stage,failure] of [['sync',Object.assign(new Error('unsupported'),{code:'EINVAL'})],['sync',Object.assign(new Error('unsupported'),{code:'ENOTSUP'})],['close',null],['close',undefined]]) {
    const f = fixture({ hook: async name => { if (name === stage) throw failure; } });
    await assert.rejects(f.service.syncParentDirectory(input), error => error === failure);
    assert.equal(f.calls.filter(name => name === 'open').length, 1); assert.equal(f.calls.filter(name => name === 'close').length, 1);
  }
});

test('missing and non-directory parents cannot create or sync a replacement', async () => {
  for (const stage of ['path-stat','open']) {
    const failure = Object.assign(new Error('missing'), { code: 'ENOENT' });
    const f = fixture({ hook: async name => { if (name === stage) throw failure; } });
    await assert.rejects(f.service.syncParentDirectory(input), error => error === failure);
    assert.ok(!f.calls.includes('close')); assert.ok(!f.calls.includes('sync'));
  }
  const f = fixture(); f.changePath({ isDirectory: () => false });
  await assert.rejects(f.service.syncParentDirectory(input), { code: 'backup_artifact_directory_identity_mismatch' });
  assert.ok(!f.calls.includes('open'));
});

test('opened or post-close directory replacement refuses identity acceptance', async () => {
  for (const moment of ['open','close']) {
    let f; f = fixture({ hook: async name => {
      if (name !== moment) return;
      if (moment === 'open') f.changeHandle({ ino: 3n }); else f.changePath({ ino: 4n });
    } });
    await assert.rejects(f.service.syncParentDirectory(input), { code: 'backup_artifact_directory_identity_mismatch' });
    assert.equal(f.calls.filter(name => name === 'close').length, 1);
    if (moment === 'open') assert.ok(!f.calls.includes('sync'));
  }
});

test('directory ownership loss refuses future sync or acceptance and still closes an owned handle', async () => {
  for (const lostAt of [2,3,4]) {
    let checks = 0; const failure = new Error('lost ownership');
    const f = fixture({ hook: async name => { if (name === 'owner' && ++checks === lostAt) throw failure; } });
    await assert.rejects(f.service.syncParentDirectory(input), error => error === failure);
    assert.equal(f.calls.includes('close'), lostAt !== 2); assert.equal(f.calls.includes('sync'), lostAt === 4);
  }
});

test('directory checkpoint remains unsettled until delayed close drains', async () => {
  const ready = Promise.withResolvers(), finish = Promise.withResolvers(); let settled = false;
  const f = fixture({ hook: async name => { if (name === 'close') { ready.resolve(); await finish.promise; } } });
  const task = f.service.syncParentDirectory(input).finally(() => { settled = true; });
  try { await Promise.race([ready.promise,task.then(() => { throw new Error('settled early'); })]); assert.equal(settled,false); }
  finally { finish.resolve(); await task; }
});
