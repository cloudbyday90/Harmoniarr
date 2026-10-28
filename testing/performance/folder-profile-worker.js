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
import { prepareFolderProfileFixture, resolveFolderProfileCase, removeFolderProfileFixture } from './folder-profile-fixture.js';
import { measureFolderProfileWork, readFolderProfileCgroup } from './folder-profile-memory.js';
import { createFolderProfileWorkload } from './folder-profile-workload.js';

const input = JSON.parse(process.argv[2]); assertProfileOwner(input.owner);
const parent = '/fixtures'; let result;
if (input.phase === 'prepare') result = await prepareFolderProfileFixture({ parent, owner: input.owner, cases: input.cases });
else if (input.phase === 'cleanup') result = await removeFolderProfileFixture({ parent, owner: input.owner });
else if (input.phase === 'probe' || input.phase === 'sample') {
  if (typeof globalThis.gc !== 'function') throw new TypeError('Explicit profile GC is required');
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
    const work = createFolderProfileWorkload({ createService: createFolderBrowseService, path, caseName: input.caseName, algorithm: input.algorithm, pages: input.pages });
    const hostLoadAverage = loadavg();
    result = { ...await measureFolderProfileWork(work, { observed: input.observed }), filesystemType, cgroupBefore: before, cgroupAfter: await readFolderProfileCgroup(), hostLoadAverage };
    assert.equal(result.cgroupAfter.events.oom_kill - before.events.oom_kill, 0);
  }
} else throw new TypeError('Invalid profile phase');
process.stdout.write(JSON.stringify({ owner: input.owner, phase: input.phase, result }) + '\n');
