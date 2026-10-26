/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join, basename } from 'node:path';
import test from 'node:test';
import { closePool } from '../../src/server/database.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createLibraryTagExtractionService } from '../../src/server/library/library-tag-extraction-service.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';

await requireDeploymentMemoryProfile();
test('updated metadata parser preserves production tag projections and classifies unsupported bytes', { timeout: 60_000 }, async t => {
  t.after(closePool);
  assert.equal(JSON.parse(await readFile('/app/node_modules/music-metadata/package.json')).version, '12.2.3');
  assert.equal(JSON.parse(await readFile('/app/node_modules/strtok3/package.json')).version, '10.6.2');
  const root = await mkdtemp('/tmp/metadata-parser-');
  const libraryRoot = join(root, 'library'); await mkdir(libraryRoot);
  const command = createMediaCommandService({ allowedBinaries: ['ffmpeg'] });
  const runId = randomUUID(), libraryRootId = randomUUID();
  const projections = [];
  const service = createLibraryTagExtractionService({ writeOwnedLibraryFileTagSnapshot: async input => { projections.push(input); } });
  const formats = [['flac', 'flac'], ['mp3', 'libmp3lame'], ['opus', 'libopus'], ['wav', 'pcm_s16le'], ['m4a', 'aac']];
  const measurements = [];
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  async function extract(path) {
    const file = await stat(path);
    return service.extractLibraryFileTags({ runId, libraryRootId, libraryRootPath: libraryRoot, requestedLibraryRoot: libraryRoot,
      expectedLease: createOperationRunLeaseFixture({ runId, jobType: 'library_scan' }),
      files: [{ id: randomUUID(), canonicalPath: path, fileState: 'observed', filename: basename(path), relativePath: basename(path),
        extension: extname(path), sizeBytes: file.size, modifiedAt: file.mtime }],
    });
  }
  try {
    for (const [extension, encoder] of formats) {
      const path = join(libraryRoot, 'track.'+extension);
      await command.runCommand({ binary: 'ffmpeg', args: ['-v','error','-nostdin','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1',
        '-ac','2','-threads','2','-c:a',encoder,'-metadata','artist=Qualification Artist','-metadata','album=Qualification Album',
        '-metadata','title=Qualification Track',path], timeoutMs: 30_000 });
      const before = hash(await readFile(path));
      const result = await extract(path);
      const payload = projections.at(-1).payload;
      assert.equal(payload.status, 'extracted'); assert.equal(payload.channels, 2); assert.equal(payload.sampleRateHz, 48000);
      assert.ok(payload.durationMs >= 900 && payload.durationMs <= 1400);
      assert.equal(payload.normalizedTags.artist, 'Qualification Artist'); assert.equal(payload.normalizedTags.album, 'Qualification Album');
      assert.equal(payload.normalizedTags.title, 'Qualification Track'); assert.equal(result.files[0].tagPayload.title, 'Qualification Track');
      assert.equal(hash(await readFile(path)), before);
      measurements.push({ extension, sourceBytesPreserved: true, projectedTagsVerified: true, channels: payload.channels, sampleRateHz: payload.sampleRateHz });
    }
    const truncated = join(libraryRoot, 'truncated.flac'); await writeFile(truncated, 'fLaC');
    await extract(truncated);
    assert.equal(projections.at(-1).payload.status, 'extracted');
    assert.equal(projections.at(-1).payload.channels, null); assert.equal(projections.at(-1).payload.sampleRateHz, null);
    assert.equal(await readFile(truncated, 'utf8'), 'fLaC');
    const unsupported = join(libraryRoot, 'unsupported.bin'); await writeFile(unsupported, 'not an audio container');
    const result = await extract(unsupported);
    assert.equal(projections.at(-1).payload.status, 'failed'); assert.equal(result.files[0].tagPayload, null);
    assert.equal(await readFile(unsupported, 'utf8'), 'not an audio container');
    t.diagnostic(JSON.stringify({ parserVersion: '12.2.3', tokenizerVersion: '10.6.2', measurements, unsupportedBytesFailed: true, headerOnlyFlacHasNoAudioFacts: true,
      productionParserAndProjection: true, snapshotWriterIsControlled: true, noDatabasePersistenceClaim: true }));
  } finally { await rm(root, { recursive: true, force: true }); }
});
