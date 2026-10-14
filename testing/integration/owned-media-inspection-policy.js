/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const mediaInspectionPrefix = Object.freeze(['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams']);
export const mediaExecutorError = code => Object.assign(new Error('Owned media fixture refused unsafe work'), { code });
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
function contained(root, source) {
  const path = relative(root, source);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) throw mediaExecutorError('fixture_media_path_refused');
  return path;
}

/** Capture the current private root once; every inspection rechecks real containment. */
export async function captureMediaInspectionPolicy(workspaceDir) {
  if (typeof workspaceDir !== 'string' || !isAbsolute(workspaceDir) || workspaceDir.includes(',')) throw mediaExecutorError('fixture_media_path_refused');
  const root = resolve(workspaceDir); const canonical = await realpath(root); const identity = await stat(root);
  if (canonical !== root || !identity.isDirectory()) throw mediaExecutorError('fixture_media_path_refused');
  async function assertRoot() {
    if (await realpath(root) !== canonical || !sameFile(identity, await stat(root))) throw mediaExecutorError('fixture_media_root_changed');
  }
  return Object.freeze({ root, assertRoot, async map(binary, args, { readonly = true } = {}) {
    if (binary !== 'ffprobe' || readonly !== true || !Array.isArray(args) || args.length !== 7
      || mediaInspectionPrefix.some((value, i) => args[i] !== value) || typeof args[6] !== 'string' || !isAbsolute(args[6])) {
      throw mediaExecutorError('fixture_media_command_refused');
    }
    await assertRoot();
    const source = resolve(args[6]); contained(root, source);
    const current = await realpath(source); const scoped = contained(canonical, current);
    if (!(await stat(current)).isFile()) throw mediaExecutorError('fixture_media_path_refused');
    return [...mediaInspectionPrefix, `/fixtures/${scoped.split(sep).join('/')}`];
  } });
}
