/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { lstat, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

export async function assertDockerProjectRemoved({ projectName, env, runCommandFn }) {
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(projectName ?? '')) {
    throw new Error('Docker acceptance project identity is invalid');
  }
  const filter = `label=com.docker.compose.project=${projectName}`;
  for (const [kind, options, format] of [
    ['container', ['--all'], '{{.ID}}'], ['network', [], '{{.ID}}'], ['volume', [], '{{.Name}}'],
  ]) {
    const result = await runCommandFn({ command: 'docker',
      args: [kind, 'ls', ...options, '--filter', filter, '--format', format], env });
    if (result.exitCode !== 0 || result.stdout.trim()) {
      throw new Error('Owned Docker acceptance resource cleanup could not be verified');
    }
  }
}

export async function removeOwnedDockerWorkspace({ workspaceRoot, tempRootDir, prefix, removeFn = rm }) {
  const target = resolve(workspaceRoot);
  if (dirname(target) !== resolve(tempRootDir) || !basename(target).startsWith(prefix)) {
    throw new Error('Docker acceptance workspace ownership could not be verified');
  }
  try {
    const details = await lstat(target);
    if (!details.isDirectory() || details.isSymbolicLink()) {
      throw new Error('Docker acceptance workspace ownership could not be verified');
    }
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await removeFn(target, { force: true, recursive: true });
  try { await lstat(target); } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error('Owned Docker acceptance workspace cleanup could not be verified');
}

export async function cleanupDockerSmokeWorkspace({
  composeArgs, env, projectName, removeFn, runCommandFn, stopProjectFn, strictCleanup,
  tempRootDir, workspaceRoot, workspacePrefix,
}) {
  try {
    await stopProjectFn({ composeArgs, env, removeVolumes: true, runCommandFn });
    if (strictCleanup) await assertDockerProjectRemoved({ projectName, env, runCommandFn });
  } catch {
    // Retain disposable bind data when a container may still be using it.
    if (strictCleanup) throw new Error('Owned Docker acceptance resource cleanup could not be verified');
  }
  if (strictCleanup) {
    await removeOwnedDockerWorkspace({ workspaceRoot, tempRootDir, prefix: workspacePrefix, removeFn });
  } else {
    await removeFn(workspaceRoot, { force: true, recursive: true });
  }
}
