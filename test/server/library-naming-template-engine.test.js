import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_NAMING_TEMPLATES,
  listAvailableTokens,
  NAMING_TEMPLATE_TOKENS,
  resolveTemplate,
  validateTemplate,
} from '../../src/server/library/library-naming-template-engine.js';

test('resolveTemplate replaces a single token with its context value', () => {
  assert.equal(
    resolveTemplate('{ArtistName}', { ArtistName: 'Radiohead' }),
    'Radiohead',
  );
});

test('resolveTemplate replaces multiple tokens in a single template', () => {
  assert.equal(
    resolveTemplate('{ArtistName} - {SongTitle}', {
      ArtistName: 'Boards of Canada',
      SongTitle: 'Roygbiv',
    }),
    'Boards of Canada - Roygbiv',
  );
});

test('resolveTemplate leaves unknown tokens as literal text', () => {
  assert.equal(
    resolveTemplate('{ArtistName} - {UnknownToken}', { ArtistName: 'Aphex Twin' }),
    'Aphex Twin - {UnknownToken}',
  );
});

test('resolveTemplate leaves unknown tokens unchanged when context is empty', () => {
  assert.equal(
    resolveTemplate('{ArtistName} - {SongTitle}', {}),
    '{ArtistName} - {SongTitle}',
  );
});

test('resolveTemplate preserves surrounding literal text', () => {
  assert.equal(
    resolveTemplate('prefix/{ArtistName}/suffix', { ArtistName: 'Autechre' }),
    'prefix/Autechre/suffix',
  );
});

test('resolveTemplate truncates resolved value when :NN suffix is specified', () => {
  assert.equal(
    resolveTemplate('{AlbumTitle:10}', { AlbumTitle: 'Music Has the Right to Children' }),
    'Music Has ',
  );
});

test('resolveTemplate truncates to zero length when :0 suffix is specified', () => {
  assert.equal(
    resolveTemplate('{AlbumTitle:0}', { AlbumTitle: 'Geogaddi' }),
    '',
  );
});

test('resolveTemplate ignores truncation on unknown tokens', () => {
  assert.equal(
    resolveTemplate('{Unknown:5}', {}),
    '{Unknown:5}',
  );
});

test('resolveTemplate handles multiple occurrences of the same token', () => {
  assert.equal(
    resolveTemplate('{ArtistName}/{ArtistName}', { ArtistName: 'Squarepusher' }),
    'Squarepusher/Squarepusher',
  );
});

test('resolveTemplate converts non-string context values to strings', () => {
  assert.equal(
    resolveTemplate('{ReleaseYear}', { ReleaseYear: 1997 }),
    '1997',
  );
});

test('resolveTemplate treats null context values as unresolved', () => {
  assert.equal(
    resolveTemplate('{ArtistName}', { ArtistName: null }),
    '{ArtistName}',
  );
});

test('resolveTemplate treats undefined context values as unresolved', () => {
  assert.equal(
    resolveTemplate('{ArtistName}', { ArtistName: undefined }),
    '{ArtistName}',
  );
});

test('resolveTemplate returns empty string for non-string template', () => {
  assert.equal(resolveTemplate(42, {}), '');
  assert.equal(resolveTemplate(null, {}), '');
  assert.equal(resolveTemplate(undefined, {}), '');
});

test('resolveTemplate returns empty string for empty template', () => {
  assert.equal(resolveTemplate('', {}), '');
});

test('resolveTemplate handles template with no tokens', () => {
  assert.equal(resolveTemplate('plain text', {}), 'plain text');
});

test('resolveTemplate produces default album folder pattern', () => {
  assert.equal(
    resolveTemplate(DEFAULT_NAMING_TEMPLATES.albumFolderFormat, {
      AlbumTitle: 'Selected Ambient Works 85-92',
      ReleaseYear: '1992',
    }),
    'Selected Ambient Works 85-92 (1992)',
  );
});

test('resolveTemplate produces default track filename pattern', () => {
  assert.equal(
    resolveTemplate(DEFAULT_NAMING_TEMPLATES.trackFilenameFormat, {
      TrackNumber: '01',
      SongTitle: 'Xtal',
    }),
    '01 - Xtal',
  );
});

test('resolveTemplate produces default multi-disc track filename pattern', () => {
  assert.equal(
    resolveTemplate(DEFAULT_NAMING_TEMPLATES.multiDiscTrackFilenameFormat, {
      DiscNumber: '2',
      TrackNumber: '03',
      SongTitle: 'Weathercocks',
    }),
    '2-03 - Weathercocks',
  );
});

test('validateTemplate accepts a valid template', () => {
  const result = validateTemplate('{ArtistName} - {SongTitle}');
  assert.deepEqual(result, { valid: true });
});

test('validateTemplate accepts a template with no tokens', () => {
  const result = validateTemplate('Unknown Artist');
  assert.deepEqual(result, { valid: true });
});

test('validateTemplate rejects non-string input', () => {
  const result = validateTemplate(42);
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('string'));
});

test('validateTemplate rejects empty string', () => {
  const result = validateTemplate('');
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('empty'));
});

test('validateTemplate rejects whitespace-only string', () => {
  const result = validateTemplate('   ');
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('empty'));
});

test('validateTemplate rejects forward slash', () => {
  const result = validateTemplate('{ArtistName}/{AlbumTitle}');
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('path separator'));
});

test('validateTemplate rejects backslash', () => {
  const result = validateTemplate('{ArtistName}\\{AlbumTitle}');
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('path separator'));
});

test('validateTemplate rejects parent directory reference', () => {
  const result = validateTemplate('..');
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('parent directory'));
});

test('validateTemplate rejects parent directory embedded in template', () => {
  const result = validateTemplate('{ArtistName}/../etc/passwd');
  assert.equal(result.valid, false);
});

test('NAMING_TEMPLATE_TOKENS defines all Phase 1 core tokens', () => {
  const tokenNames = Object.keys(NAMING_TEMPLATE_TOKENS);
  assert.ok(tokenNames.includes('ArtistName'));
  assert.ok(tokenNames.includes('AlbumTitle'));
  assert.ok(tokenNames.includes('ReleaseYear'));
  assert.ok(tokenNames.includes('SongTitle'));
  assert.ok(tokenNames.includes('TrackNumber'));
  assert.ok(tokenNames.includes('DiscNumber'));
  assert.ok(tokenNames.includes('DiscCount'));
  assert.equal(tokenNames.length, 7);
});

test('NAMING_TEMPLATE_TOKENS each have a description and availableIn array', () => {
  for (const [name, meta] of Object.entries(NAMING_TEMPLATE_TOKENS)) {
    assert.ok(typeof meta.description === 'string' && meta.description.length > 0, `Token ${name} missing description`);
    assert.ok(Array.isArray(meta.availableIn) && meta.availableIn.length > 0, `Token ${name} missing availableIn`);
  }
});

test('listAvailableTokens returns an array with name, description, and availableIn', () => {
  const tokens = listAvailableTokens();
  assert.equal(tokens.length, 7);
  const artistToken = tokens.find((t) => t.name === 'ArtistName');
  assert.ok(artistToken);
  assert.equal(typeof artistToken.description, 'string');
  assert.ok(Array.isArray(artistToken.availableIn));
});

test('DEFAULT_NAMING_TEMPLATES has exactly four template keys', () => {
  const keys = Object.keys(DEFAULT_NAMING_TEMPLATES);
  assert.deepEqual(keys, [
    'artistFolderFormat',
    'albumFolderFormat',
    'trackFilenameFormat',
    'multiDiscTrackFilenameFormat',
  ]);
});

test('DEFAULT_NAMING_TEMPLATES values are frozen and immutable', () => {
  assert.ok(Object.isFrozen(DEFAULT_NAMING_TEMPLATES));
  assert.throws(() => { DEFAULT_NAMING_TEMPLATES.artistFolderFormat = 'mutated'; });
});

test('resolveTemplate with :NN truncation at exact string length returns full value', () => {
  assert.equal(
    resolveTemplate('{SongTitle:5}', { SongTitle: 'Hello' }),
    'Hello',
  );
});

test('resolveTemplate with :NN truncation longer than value returns full value', () => {
  assert.equal(
    resolveTemplate('{SongTitle:100}', { SongTitle: 'Hi' }),
    'Hi',
  );
});

test('resolveTemplate handles empty string context values', () => {
  assert.equal(
    resolveTemplate('{ArtistName} - {SongTitle}', { ArtistName: '', SongTitle: 'test' }),
    ' - test',
  );
});
