/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { lstat, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { inspectNativeFile } from './native-file-inspection.js';

export async function inspectCompletedNativeFiles(files, root = '/downloads') {
  const results = [];
  for (const file of files) {
    const deadline = performance.now() + 15_000;
    let ready = false;
    do {
      try { ready = (await lstat(root + '/' + file.filename.replaceAll('\\', '/'))).size === file.size; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (ready) break;
      await delay(100);
    } while (performance.now() < deadline);
    assert.equal(ready, true, 'Provider must publish the declared complete file');
    results.push(await inspectNativeFile(root, file));
  }
  return results;
}

export async function assertNativeFileTree(files, root = '/downloads', maxDepth = 1) {
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > 2) throw new TypeError('Invalid native tree depth');
  const paths = [];
  async function visit(directory, prefix = '', depth = 0) {
    assert.ok(depth <= maxDepth);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory()) await visit(directory + '/' + entry.name, relative + '/', depth + 1);
      else { assert.equal(entry.isFile(), true); paths.push(relative); assert.ok(paths.length <= files.length); }
    }
  }
  await visit(root);
  assert.deepEqual(paths.sort(), files.map(file => file.filename.replaceAll('\\', '/')).sort());
}
