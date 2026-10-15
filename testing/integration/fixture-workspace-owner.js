/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { lstat, mkdtemp, realpath, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const refused = () => Object.assign(new Error('Fixture workspace cleanup requires verified quiescence'), { code: 'fixture_workspace_not_quiescent' });
export function assertFixtureScenarioName(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/u.test(name)) throw new TypeError('Invalid fixture scenario name');
}
async function captureDirectory(path) {
  if (!isAbsolute(path) || resolve(path) !== path) throw refused();
  const identity = await lstat(path, { bigint: true });
  if (!identity.isDirectory() || identity.isSymbolicLink() || await realpath(path) !== path) throw refused();
  return async () => {
    const current = await lstat(path, { bigint: true });
    if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino
      || await realpath(path) !== path) throw refused();
  };
}
async function assertGuard(guard) {
  let safe = false;
  try { safe = await guard() === true; } catch { /* A thrown predicate never grants deletion. */ }
  if (!safe) throw refused();
}

/** A retained child permanently vetoes parent removal; later predicates cannot erase that evidence. */
export async function captureFixtureWorkspaceOwner(root) {
  const assertRoot = await captureDirectory(root);
  let retained = false; let unsafe = false; let failure;
  const retainUnsafe = error => { retained = true; if (!unsafe) { unsafe = true; failure = error; } };
  async function withScenario({ name, guard, keepArtifactsOnFailure, observer }, run) {
    assertFixtureScenarioName(name);
    let path; let assertChild;
    try {
      await assertRoot();
      path = await observer.measure('workspace_create', () => mkdtemp(join(root, `${name}-`)));
      assertChild = await captureDirectory(path);
    } catch (error) { retainUnsafe(error); throw error; }
    let result; let failed = false; let primary;
    try { result = await run(path); } catch (error) { failed = true; primary = error; }
    try {
      await assertGuard(guard); await assertRoot(); await assertChild();
      if (failed && keepArtifactsOnFailure) retained = true;
      else await observer.measure('workspace_remove', () => rm(path, { force: true, recursive: true }));
    } catch (error) {
      retainUnsafe(failed ? primary : error);
      if (!failed) { failed = true; primary = error; }
    }
    if (failed) throw primary;
    return result;
  }
  function finish({ release, guard, observer }) {
    return withWorkerTaskCleanup(() => { if (unsafe) throw failure; }, () => withWorkerTaskCleanup(release, async () => {
      if (retained) return;
      await assertGuard(guard); await assertRoot();
      await observer.measure('workspace_remove', () => rm(root, { force: true, recursive: true }));
    }));
  }
  return Object.freeze({ withScenario, finish });
}
