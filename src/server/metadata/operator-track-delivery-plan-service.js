/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { posix as path } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { realpath } from 'node:fs/promises';
import { getPool } from '../database.js';
import { loadSettings } from '../settings.js';
import { buildUserMusicRootPath } from '../paths/user-music-root-service.js';
import { createOperatorTrackAcquisitionStore } from './operator-track-acquisition-store.js';
import { refuseOperatorTrackFiles } from './operator-track-file-policy.js';

const normalize = value => typeof value === 'string' ? value.replaceAll('\\', '/').replace(/\/+$/u, '') : '';
const within = (filePath, root) => path.resolve(normalize(filePath)).toLowerCase().startsWith(`${path.resolve(normalize(root)).toLowerCase()}/`);

export function createOperatorTrackDeliveryPlanService({ getPoolFn = getPool,
  store = createOperatorTrackAcquisitionStore({ getPoolFn }), loadSettingsFn = loadSettings, realpathFn = realpath } = {}) {
  async function resolvePrivateOwnerRoot({ ownerId, queryable = null, settings = null }) {
    const currentSettings = settings ?? await loadSettingsFn(queryable ?? getPoolFn());
    const musicRoot = currentSettings.paths?.music;
    const owner = await store.readDeliveryOwner({ ownerId, queryable });
    if (!musicRoot || !owner || owner.is_disabled === true || !owner.managed_library_relative_root) throw refuseOperatorTrackFiles();
    const root = buildUserMusicRootPath({ musicRoot, relativeRoot: owner.managed_library_relative_root });
    try {
      const actual = normalize(await realpathFn(root));
      const expected = normalize(buildUserMusicRootPath({ musicRoot: await realpathFn(musicRoot), relativeRoot: owner.managed_library_relative_root }));
      const compare = value => process.platform === 'win32' ? value.toLowerCase() : value;
      if (compare(actual) !== compare(expected)) throw refuseOperatorTrackFiles();
    } catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error; }
    return root;
  }
  async function readRoots({ selection, settings = null, queryable = null }) {
    const currentSettings = settings ?? await loadSettingsFn(queryable ?? getPoolFn());
    const musicRoot = currentSettings.paths?.music;
    if (!musicRoot) throw refuseOperatorTrackFiles();
    const roots = [];
    for (const participant of selection.participants) {
      roots.push({ participant, root: await resolvePrivateOwnerRoot({ ownerId: participant.ownerId, queryable, settings: currentSettings }) });
    }
    if (roots.length !== 2 || within(roots[0].root, roots[1].root) || within(roots[1].root, roots[0].root)
      || normalize(roots[0].root).toLowerCase() === normalize(roots[1].root).toLowerCase()) throw refuseOperatorTrackFiles();
    return roots;
  }
  async function planFilePreviews({ selection, filePreviews, relativeFolderPath, settings, queryable = null }) {
    const roots = await readRoots({ selection, settings, queryable });
    return filePreviews.map(file => {
      const binding = selection.bindings.find(entry => entry.fileId === file.fileId);
      const target = roots.find(entry => entry.participant.scope.tracks[0].metadataTrackId === binding?.track.metadataTrackId);
      if (!target) throw refuseOperatorTrackFiles();
      return { ...file, libraryPath: path.join(target.root, relativeFolderPath, file.filename),
        delivery: { ...target.participant, libraryRoot: target.root } };
    });
  }
  async function assertPreviewCurrent({ selection, files, queryable = null }) {
    const roots = await readRoots({ selection, queryable });
    if (files?.length !== selection.bindings.length) throw refuseOperatorTrackFiles();
    for (const binding of selection.bindings) {
      const file = files.find(entry => entry.fileId === binding.fileId);
      const target = roots.find(entry => entry.participant.scope.tracks[0].metadataTrackId === binding.track.metadataTrackId);
      if (!target || !file || !isDeepStrictEqual(file.delivery, { ...target.participant, libraryRoot: target.root })
        || !within(file.libraryTarget?.path ?? file.libraryPath, target.root)) throw refuseOperatorTrackFiles();
    }
  }
  return { planFilePreviews, assertPreviewCurrent, assertRecipientsCurrent: readRoots, resolvePrivateOwnerRoot };
}
