/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const formats = [['flac', 'flac'], ['mp3', 'libmp3lame'], ['opus', 'libopus'], ['wav', 'pcm_s16le']];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function snapshot(root, relative = '') {
  const rows = [];
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) rows.push(...await snapshot(root, path));
    else { assert.ok(entry.isFile()); rows.push({ path, sha256: digest(await readFile(join(root, path))) }); }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
export async function withDeploymentMediaFixture(work) {
  const root = await mkdtemp('/app/data/media-memory-'); const libraryRoot = join(root, 'library');
  const command = createMediaCommandService({ allowedBinaries: ['ffmpeg', 'ffprobe'] });
  return withWorkerTaskCleanup(async () => {
    await mkdir(libraryRoot); const sources = [];
    for (const [extension, encoder] of formats) {
      const folder = join(libraryRoot, extension); await mkdir(folder);
      const source = join(folder, `01.${extension}`); sources.push(source);
      await command.runCommand({ binary: 'ffmpeg', args: ['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1',
        '-ac', '2', '-threads', '2', '-c:a', encoder, '-metadata', 'artist=Qualification Artist', '-metadata', 'album=Qualification Album',
        '-metadata', 'title=Qualification Track', source], timeoutMs: 30_000 });
      for (let i = 2; i <= 16; i++) await copyFile(source, join(folder, `${String(i).padStart(2, '0')}.${extension}`));
    }
    const longSource = join(root, 'preflight.wav');
    await command.runCommand({ binary: 'ffmpeg', args: ['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'sine=frequency=997:sample_rate=96000:duration=120',
      '-ac', '2', '-threads', '2', '-c:a', 'pcm_s24le', longSource], timeoutMs: 30_000 });
    const before = await snapshot(root); assert.equal(before.length, 65);
    const version = (await command.runCommand({ binary: 'ffmpeg', args: ['-version'] })).stdout.split('\n')[0].split(' ')[2];
    const result = await work({ libraryRoot, sources, longSource, fileCount: 64, ffmpegVersion: version });
    assert.deepEqual(await snapshot(root), before, 'Scanning/preflight must preserve every original byte and create no converted output');
    return { ...result, mediaFixture: { files: 64, formats: formats.map(([format]) => format), originalFilesUnchanged: true,
      originalProjectionSha256: digest(Buffer.from(JSON.stringify(before))), ffmpegVersion: version, preflightSeconds: 120, sampleRate: 96000, channels: 2 } };
  }, () => rm(root, { recursive: true, force: true }));
}
