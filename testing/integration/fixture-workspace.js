/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

export async function withFixtureWorkspace({ prefix, baseDirectory = tmpdir(), createDirectory = mkdtemp,
  resolveDirectory = realpath, removeDirectory = rm } = {}, work) {
  if (typeof prefix !== 'string' || !/^[a-z][a-z0-9-]{1,60}-$/u.test(prefix)
    || typeof baseDirectory !== 'string' || !baseDirectory
    || ![createDirectory, resolveDirectory, removeDirectory, work].every((fn) => typeof fn === 'function')) {
    throw new TypeError('Fixture workspace requires a bounded prefix, directory and callbacks');
  }
  const base = await resolveDirectory(resolve(baseDirectory));
  const requestedRoot = await createDirectory(join(base, prefix));
  const target = resolve(requestedRoot); const delta = relative(base, target);
  if (!delta || delta.startsWith('..') || isAbsolute(delta) || !basename(target).startsWith(prefix)) {
    throw new Error('Fixture workspace cleanup ownership could not be verified');
  }
  let failed = false; let failure; let result;
  try {
    const rootPath = await resolveDirectory(requestedRoot);
    const rootDelta = relative(base, rootPath);
    if (!rootDelta || rootDelta.startsWith('..') || isAbsolute(rootDelta)) throw new Error('Fixture workspace resolved outside its owned directory');
    result = await work({ requestedRoot, rootPath });
  } catch (error) { failed = true; failure = error; }
  try { await removeDirectory(target, { recursive: true, force: true }); }
  catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return result;
}
