/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile, statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadavg } from 'node:os';
import { folderProfileSources, assertProfileOwner } from './folder-profile-policy.js';
import { prepareFolderProfileFixture, resolveFolderProfileCase, removeFolderProfileFixture, seedFolderProfileOverflow } from './folder-profile-fixture.js';
import { measureFolderProfileWork, readFolderProfileCgroup } from './folder-profile-memory.js';
import { createFolderProfileWorkload } from './folder-profile-workload.js';
import { createConcurrentFolderProfileWorkload, runConcurrentFolderProfileControls } from './folder-profile-concurrent-workload.js';
import { createFolderPromotionWorkload } from './folder-profile-promotion-workload.js';
import { observeFolderRetention } from './folder-retention-observer.js';

const input = JSON.parse(process.argv[2]); assertProfileOwner(input.owner);
const parent = '/fixtures'; let result;
if (input.phase === 'prepare') result = await prepareFolderProfileFixture({ parent, owner: input.owner, cases: input.cases });
else if (input.phase === 'cleanup') result = await removeFolderProfileFixture({ parent, owner: input.owner });
else if (input.phase === 'overflow-seed') result = await seedFolderProfileOverflow({ parent, owner: input.owner, caseName: input.caseName });
else if (['probe', 'sample', 'lifecycle', 'promotion', 'overflow', 'retention'].includes(input.phase)) {
  const naturalRetention = input.phase === 'retention' && input.mode === 'natural';
  assert.equal(typeof globalThis.gc === 'function', !naturalRetention, 'GC exposure must match the selected profile');
  const before = await readFolderProfileCgroup();
  assert.equal(before.limitBytes, 1024 ** 3); assert.equal(before.swapMaxBytes, 0); assert.equal(before.cpus, 2);
  assert.equal(process.getuid(), 1000);
  const moduleRoot = '/app/server-dist';
  const { createFolderBrowseService } = await import(pathToFileURL(resolve(moduleRoot, 'filesystem/folder-browse-service.js')).href);
  if (input.phase === 'probe') {
    const sources = await Promise.all(folderProfileSources.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(resolve(moduleRoot, path))).digest('hex') })));
    result = { sources, node: process.versions.node, platform: process.platform, arch: process.arch, uid: process.getuid(), cgroup: before, hostLoadAverage: loadavg() };
  } else {
    const path = await resolveFolderProfileCase({ parent, owner: input.owner, caseName: input.caseName });
    const filesystemType = (await statfs(path)).type;
    const options = { createService: createFolderBrowseService, path, caseName: input.caseName, algorithm: input.algorithm, bufferSize: input.bufferSize, pages: input.pages };
    const work = input.phase === 'retention' ? null : ['promotion', 'overflow'].includes(input.phase) ? createFolderPromotionWorkload({ ...options, overflow: input.phase === 'overflow' })
      : input.phase === 'lifecycle' ? () => runConcurrentFolderProfileControls(options)
      : input.concurrency === 4 ? createConcurrentFolderProfileWorkload(options) : createFolderProfileWorkload(options);
    const hostLoadAverage = loadavg();
    const measurements = input.phase === 'retention' ? await observeFolderRetention({ ...options, mode: input.mode }, {
      onCheckpoint: record => new Promise((resolveOutput, rejectOutput) => {
        process.stdout.write(JSON.stringify({ owner: input.owner, phase: 'retention-checkpoint', ...record }) + '\n', error => { if (error) rejectOutput(error); else resolveOutput(); });
      }),
    })
      : await measureFolderProfileWork(work, { observed: input.observed });
    result = { ...measurements, filesystemType, cgroupBefore: before, cgroupAfter: await readFolderProfileCgroup(), hostLoadAverage };
    assert.equal(result.cgroupAfter.events.oom_kill - before.events.oom_kill, 0);
  }
} else throw new TypeError('Invalid profile phase');
process.stdout.write(JSON.stringify({ owner: input.owner, phase: input.phase, result }) + '\n');
