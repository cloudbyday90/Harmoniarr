/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createFolderProfilePlan, folderProfileSources } from './folder-profile-policy.js';
import { profileDocker, withFolderProfileContainer } from './folder-profile-docker.js';

/** Explicit local measurement, separate from startup and the routine validation gate. */
export async function runFolderProfile(selection, { signal, docker = profileDocker, onProgress = () => {} } = {}) {
  const owner = randomUUID(), plan = createFolderProfilePlan(selection);
  const report = { version: 2, comparison: selection.comparison ?? 'algorithms', storage: selection.storage, image: selection.image, owner, cases: selection.cases,
    repeats: selection.repeats, resources: { cpus: 2, memoryBytes: 1024 ** 3, swapBytes: 0 }, cacheCleared: false, samples: [], cleanup: {} };
  const benchmarkPath = await realpath(new URL('.', import.meta.url));
  if (/[,\r\n\0]/u.test(benchmarkPath)) throw new TypeError('Unsupported benchmark mount path');
  let volume, bindPath, bindParent, storageMount, failed = false, failure, attempted = 0, retired = 0;
  const run = async (phase, row = {}, cleanup = false) => {
    if (!cleanup) signal?.throwIfAborted();
    attempted++;
    const args = ['--read-only', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--no-healthcheck',
      '--cpus', '2', '--memory', '1g', '--memory-swap', '1g', '--pids-limit', '64', '--user', ['prepare', 'cleanup'].includes(phase) ? '0:0' : '1000:1000',
      '--entrypoint', 'node', '--mount', `type=bind,src=${benchmarkPath},dst=/app/benchmark,readonly`];
    if (storageMount) args.push('--mount', storageMount + (['probe', 'sample'].includes(phase) ? ',readonly' : ''));
    const value = await withFolderProfileContainer({ args, command: ['--expose-gc', '/app/benchmark/folder-profile-worker.js', JSON.stringify({ ...row, phase, owner })],
      owner, image: selection.image, signal: cleanup ? undefined : signal, timeout: phase === 'prepare' ? 900_000 : 120_000, docker, onRetired: () => { retired++; } });
    assert.equal(value.phase, phase); return value.result;
  };
  try {
    const image = JSON.parse(await docker(['image', 'inspect', selection.image]))[0]; assert.equal(image.Id, selection.image);
    onProgress({ phase: 'probe' }); report.probe = await run('probe');
    assert.equal(report.probe.node, '24.22.1'); assert.equal(report.probe.platform, 'linux'); assert.equal(report.probe.arch, 'x64');
    const sourceRows = await Promise.all(folderProfileSources.map(async path => {
      const file = path.startsWith('../shared/') ? 'src/shared/' + basename(path) : 'src/server/' + path;
      return { path, sha256: createHash('sha256').update(await readFile(file)).digest('hex') };
    }));
    assert.deepEqual(report.probe.sources, sourceRows);
    if (selection.storage === 'volume') {
      volume = 'harmoniarr-folder-profile-' + owner;
      assert.equal((await docker(['volume', 'create', '--label', 'harmoniarr.folder-profile=' + owner, volume])).trim(), volume);
      storageMount = `type=volume,src=${volume},dst=/fixtures`;
    } else {
      bindParent = await realpath(selection.scratchRoot);
      if (/[,\r\n\0]/u.test(bindParent)) throw new TypeError('Unsupported scratch mount path');
      bindPath = await mkdtemp(resolve(bindParent, 'harmoniarr-folder-profile-'));
      assert.equal(dirname(await realpath(bindPath)), bindParent);
      await writeFile(resolve(bindPath, '.folder-profile-owner.json'), JSON.stringify({ owner }), { flag: 'wx', mode: 0o600 });
      storageMount = `type=bind,src=${bindPath},dst=/fixtures`;
    }
    onProgress({ phase: 'prepare', cases: selection.cases });
    report.preparation = await run('prepare', { cases: selection.cases });
    assert.equal(report.preparation.prepared, true); assert.deepEqual(report.preparation.cases, selection.cases);
    for (const row of plan) {
      onProgress({ phase: 'sample', completed: report.samples.length, total: plan.length, ...row });
      const result = await run('sample', row);
      report.samples.push({ ...row, ...result });
    }
  } catch (error) { failed = true; failure = error; report.failure = { name: error?.name ?? 'Unknown', code: typeof error?.code === 'string' ? error.code : null, completedSamples: report.samples.length }; }
  try {
    if (attempted !== retired) throw new Error('Uncertain process retirement; fixture retained');
    if (storageMount) { onProgress({ phase: 'cleanup' }); report.cleanup.fixture = await run('cleanup', {}, true); }
    if (volume) {
      const record = JSON.parse(await docker(['volume', 'inspect', volume]))[0]; assert.equal(record.Name, volume); assert.equal(record.Labels['harmoniarr.folder-profile'], owner);
      assert.equal((await docker(['volume', 'rm', volume])).trim(), volume); report.cleanup.volumeRemoved = true;
    }
    if (bindPath) {
      assert.equal(dirname(await realpath(bindPath)), bindParent);
      assert.equal(JSON.parse(await readFile(resolve(bindPath, '.folder-profile-owner.json'), 'utf8')).owner, owner);
      assert.deepEqual(await readdir(bindPath), ['.folder-profile-owner.json']);
      await rm(bindPath, { recursive: true, force: false }); report.cleanup.bindRemoved = true;
    }
  } catch (error) {
    report.cleanup.failure = { name: error?.name ?? 'Unknown' };
    if (!failed) { failed = true; failure = error; }
  }
  report.cleanup.attemptedContainers = attempted; report.cleanup.retiredContainers = retired;
  report.failed = failed; return { report, failed, failure };
}
