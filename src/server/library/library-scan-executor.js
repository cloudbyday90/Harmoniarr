/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { opendir, realpath, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

const audioExtensions = new Set([
  '.aac',
  '.aiff',
  '.alac',
  '.ape',
  '.flac',
  '.m4a',
  '.mp3',
  '.mpc',
  '.oga',
  '.ogg',
  '.opus',
  '.wav',
  '.wv',
]);

export async function executeLibraryScan({ libraryRoot, onFile = null }) {
  const resolvedRoot = await realpath(libraryRoot);
  const summary = {
    completedAt: new Date().toISOString(),
    directoriesSeen: 0,
    filesMatched: 0,
    filesSeen: 0,
    filesUnmatched: 0,
    libraryRoot: resolvedRoot,
    skippedSymlinks: 0,
    totalBytes: 0,
  };

  async function walkDirectory(directoryPath) {
    summary.directoriesSeen += 1;

    const directory = await opendir(directoryPath);
    for await (const entry of directory) {
      const entryPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        await walkDirectory(entryPath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        summary.skippedSymlinks += 1;
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      summary.filesSeen += 1;

      const entryStats = await stat(entryPath);
      const normalizedExtension = extname(entry.name).toLowerCase();
      const isAudioFile = audioExtensions.has(normalizedExtension);
      summary.totalBytes += Number(entryStats.size ?? 0);

      if (isAudioFile) {
        summary.filesMatched += 1;
      } else {
        summary.filesUnmatched += 1;
      }

      if (onFile) {
        await onFile({
          canonicalPath: entryPath,
          extension: normalizedExtension,
          fileState: isAudioFile ? 'observed' : 'ignored',
          filename: entry.name,
          modifiedAt: entryStats.mtime?.toISOString?.() ?? null,
          relativePath: relative(resolvedRoot, entryPath).split(sep).join('/'),
          sizeBytes: Number(entryStats.size ?? 0),
        });
      }
    }
  }

  await walkDirectory(resolvedRoot);
  summary.completedAt = new Date().toISOString();

  return summary;
}