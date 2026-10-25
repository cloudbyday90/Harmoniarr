/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { collectConfiguredPathRoots, createConfiguredPathRedactor } from '../../src/server/configured-path-redaction.js';
import { createControlPlaneRedactionService } from '../../src/server/control-plane-redaction-service.js';

test('configured paths include application roots and both mapping owners, not relative user roots', () => {
  const settings = { paths: { downloads: '/private/downloads', music: '/private/music', staging: '/private/staging',
    transcodeTemp: '/private/transcode', userMusicRoots: [{ relativeRoot: 'family' }],
    downloadMappings: [{ slskdPrefix: 'D:/remote', harmoniarrPrefix: '/private/downloads/remote' }] } };
  assert.deepEqual(collectConfiguredPathRoots(settings, '/private/app'), ['/private/app', '/private/downloads',
    '/private/music', '/private/staging', '/private/transcode', 'D:/remote', '/private/downloads/remote']);
  assert.doesNotThrow(() => createConfiguredPathRedactor(collectConfiguredPathRoots({ paths: { downloadMappings: [null] } })));
});

test('POSIX matching respects literal component boundaries, quotes, Unicode and spaces', () => {
  const redact = createConfiguredPathRedactor(['/private/Música Room/', '/private/a[1]+(x).music']);
  for (const input of ['/private/Música Room', 'open "/private/Música Room/Ártist/Album Name.flac", retry',
    'open /private/Música Room/Ártist/Album Name.flac with EIO, retry', '/private/a[1]+(x).music/file']) {
    const result = redact(input);
    assert.ok(result.includes('[REDACTED_PATH]'), result);
    assert.ok(!result.includes('/private/'), result);
    assert.ok(!result.includes('Album Name'), result);
  }
  assert.equal(redact('open "/private/Música Room/file", retry'), 'open "[REDACTED_PATH]", retry');
  assert.equal(redact('open "/private/Música Room/Artist\'s Album, disc 1/song", retry'), 'open "[REDACTED_PATH]", retry');
  assert.equal(createConfiguredPathRedactor([String.raw`/private/back\slash`])(String.raw`open "/private/back\slash/a"`),
    'open "[REDACTED_PATH]"');
  for (const input of ['/private/Música Roommate/file', '/private/Música Room.flac', '/PRIVATE/Música Room/file',
    '/other/private/Música Room/file', '/private/a11xxxmusic/file']) assert.equal(redact(input), input);
});

test('Windows drive and UNC matching works on any host with case and separator variations', () => {
  const redact = createConfiguredPathRedactor(['Q:\\Music Room\\', String.raw`\\nas\Private Share\music`]);
  for (const input of [String.raw`open "q:\MUSIC ROOM\Ártist\Song Name.flac"`, 'open "Q:/Music Room/Ártist/file"',
    String.raw`open "\\NAS\private share\MUSIC\Ártist\file"`, 'open "//nas/Private Share/music/file"']) {
    assert.equal(redact(input), 'open "[REDACTED_PATH]"');
  }
  assert.equal(redact('Q:/Music Roommate/file'), 'Q:/Music Roommate/file');
});

test('new configured-root matching preserves URL and public API tokens', () => {
  const redact = createConfiguredPathRedactor(['/private/music', '/api', '//nas/share']);
  for (const input of ['https://example.org/private/music/a', 'https://example.org/?next=/private/music/a',
    'file:///private/music/a', '/api/v1/system/overview', '/api?next=/private/music/a',
    'https://nas/share/song', '//example.org/private/music/a']) assert.equal(redact(input), input);
  assert.equal(redact('https://example.org/help then "/private/music/song"'), 'https://example.org/help then "[REDACTED_PATH]"');
});

test('invalid or overly broad roots cannot turn all slash tokens into paths', () => {
  const redact = createConfiguredPathRedactor([null, '', '/', 'relative/music', 'C:', '//nas', '/bad\nroot']);
  const input = 'read /private/music/a /api/v1/system C:relative';
  assert.equal(redact(input), input);
});

test('request-local roots do not mutate settings, leak to other redactors or lose existing secret policy', () => {
  const settings = { paths: { music: '/private/音乐' } };
  const service = createControlPlaneRedactionService({ settings, appDataPath: '/private/app' });
  settings.paths.music = '/different/root';
  const result = service.redactValue({ message: 'read "/private/音乐/artist/song"', token: 'secret',
    nested: { message: 'open /private/app/backup' }, id: 'run-1', route: '/api/v1/system/overview' });
  assert.deepEqual(result, { message: 'read "[REDACTED_PATH]"', token: '[REDACTED]', nested: { message: 'open [REDACTED_PATH]' },
    id: 'run-1', route: '/api/v1/system/overview' });
  assert.equal(createControlPlaneRedactionService().redactErrorMessage('/private/音乐/artist/song'), '/private/音乐/artist/song');
});
