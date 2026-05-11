import assert from 'node:assert/strict';
import test from 'node:test';
import { AVATAR_PALETTE, buildAvatarInitial, buildAvatarStyle, getAvatarPaletteIndex, getArtistAvatar } from '../../src/client/lib/artist-avatar.js';

// ── getAvatarPaletteIndex ────────────────────────────────────────────────────

test('getAvatarPaletteIndex returns a value in [0, AVATAR_PALETTE.length)', () => {
  const mbids = [
    'a74b1b7f-71a5-4011-9441-d0b5e4122711', // Radiohead
    '72c536dc-7137-4477-a521-567eeb840fa8', // Björk
    '381086ea-f511-4aba-bdf9-71c753dc5077', // Kendrick Lamar
    '', // edge case: empty string
    'z', // edge case: single char
  ];
  for (const mbid of mbids) {
    const index = getAvatarPaletteIndex(mbid);
    assert.ok(Number.isInteger(index), `index should be an integer for mbid "${mbid}"`);
    assert.ok(index >= 0 && index < AVATAR_PALETTE.length, `index ${index} out of range for mbid "${mbid}"`);
  }
});

test('getAvatarPaletteIndex is deterministic — same MBID always returns the same index', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  const first = getAvatarPaletteIndex(mbid);
  for (let i = 0; i < 10; i++) {
    assert.equal(getAvatarPaletteIndex(mbid), first);
  }
});

test('getAvatarPaletteIndex distributes different MBIDs across multiple palette slots', () => {
  // Generate 50 arbitrary MBID-like strings and confirm at least 3 distinct
  // palette indices are produced — verifying the hash disperses values.
  const indices = new Set();
  for (let i = 0; i < 50; i++) {
    indices.add(getAvatarPaletteIndex(`test-mbid-${i.toString().padStart(4, '0')}`));
  }
  assert.ok(indices.size >= 3, `expected distribution across multiple slots, got ${indices.size} distinct indices`);
});

test('getAvatarPaletteIndex produces different indices for distinct MBIDs', () => {
  // Two well-known MBIDs should not necessarily collide (probabilistic, but
  // deterministic enough to assert for these specific values).
  const a = getAvatarPaletteIndex('a74b1b7f-71a5-4011-9441-d0b5e4122711');
  const b = getAvatarPaletteIndex('72c536dc-7137-4477-a521-567eeb840fa8');
  // They could theoretically collide but these two don't.
  assert.notEqual(a, b);
});

// ── getArtistAvatar ──────────────────────────────────────────────────────────

test('getArtistAvatar returns bg, fg, and initial from AVATAR_PALETTE', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  const avatar = getArtistAvatar(mbid, 'Radiohead');
  const expectedIndex = getAvatarPaletteIndex(mbid);
  const expectedPalette = AVATAR_PALETTE[expectedIndex];

  assert.equal(avatar.bg, expectedPalette.bg);
  assert.equal(avatar.fg, expectedPalette.fg);
  assert.equal(avatar.initial, 'R');
});

test('getArtistAvatar uppercases the first letter of the name', () => {
  const avatar = getArtistAvatar('some-mbid', 'björk');
  assert.equal(avatar.initial, 'B');
});

test('getArtistAvatar trims leading whitespace when deriving the initial', () => {
  const avatar = getArtistAvatar('some-mbid', '  Massive Attack');
  assert.equal(avatar.initial, 'M');
});

test('getArtistAvatar returns ? initial when name is an empty string', () => {
  const avatar = getArtistAvatar('some-mbid', '');
  assert.equal(avatar.initial, '?');
});

test('getArtistAvatar returns ? initial when name is null', () => {
  const avatar = getArtistAvatar('some-mbid', null);
  assert.equal(avatar.initial, '?');
});

test('getArtistAvatar returns ? initial when name is undefined', () => {
  const avatar = getArtistAvatar('some-mbid', undefined);
  assert.equal(avatar.initial, '?');
});

test('getArtistAvatar handles a null MBID without throwing', () => {
  assert.doesNotThrow(() => getArtistAvatar(null, 'Test Artist'));
});

test('getArtistAvatar is stable — same inputs always produce the same output', () => {
  const mbid = '72c536dc-7137-4477-a521-567eeb840fa8';
  const name = 'Björk';
  const first = getArtistAvatar(mbid, name);
  for (let i = 0; i < 5; i++) {
    const next = getArtistAvatar(mbid, name);
    assert.equal(next.bg, first.bg);
    assert.equal(next.fg, first.fg);
    assert.equal(next.initial, first.initial);
  }
});

test('AVATAR_PALETTE entries all have bg and fg string properties', () => {
  for (const [index, entry] of AVATAR_PALETTE.entries()) {
    assert.equal(typeof entry.bg, 'string', `entry ${index} missing bg`);
    assert.equal(typeof entry.fg, 'string', `entry ${index} missing fg`);
    assert.ok(entry.bg.startsWith('#'), `entry ${index} bg should be a hex color`);
    assert.ok(entry.fg.startsWith('#'), `entry ${index} fg should be a hex color`);
  }
});

// ── buildAvatarStyle ─────────────────────────────────────────────────────────

test('buildAvatarStyle returns an object with background and color keys', () => {
  const style = buildAvatarStyle('a74b1b7f-71a5-4011-9441-d0b5e4122711', 'Radiohead');
  assert.ok('background' in style, 'should have background key');
  assert.ok('color' in style, 'should have color key');
});

test('buildAvatarStyle does not expose raw bg or fg keys', () => {
  const style = buildAvatarStyle('a74b1b7f-71a5-4011-9441-d0b5e4122711', 'Radiohead');
  assert.ok(!('bg' in style), 'should not expose bg');
  assert.ok(!('fg' in style), 'should not expose fg');
});

test('buildAvatarStyle background matches AVATAR_PALETTE bg for the same mbid', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  const index = getAvatarPaletteIndex(mbid);
  const style = buildAvatarStyle(mbid, 'Radiohead');
  assert.equal(style.background, AVATAR_PALETTE[index].bg);
});

test('buildAvatarStyle color matches AVATAR_PALETTE fg for the same mbid', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  const index = getAvatarPaletteIndex(mbid);
  const style = buildAvatarStyle(mbid, 'Radiohead');
  assert.equal(style.color, AVATAR_PALETTE[index].fg);
});

test('buildAvatarStyle is stable — same inputs produce same output', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  assert.deepEqual(buildAvatarStyle(mbid, 'Radiohead'), buildAvatarStyle(mbid, 'Radiohead'));
});

test('buildAvatarStyle handles null id without throwing', () => {
  assert.doesNotThrow(() => buildAvatarStyle(null, 'Test Artist'));
});

test('buildAvatarStyle handles null name without throwing', () => {
  assert.doesNotThrow(() => buildAvatarStyle('some-mbid', null));
});

// ── buildAvatarInitial ────────────────────────────────────────────────────────

test('buildAvatarInitial returns uppercase first letter of name', () => {
  assert.equal(buildAvatarInitial('some-mbid', 'radiohead'), 'R');
});

test('buildAvatarInitial returns ? for null name', () => {
  assert.equal(buildAvatarInitial('some-mbid', null), '?');
});

test('buildAvatarInitial returns ? for empty name', () => {
  assert.equal(buildAvatarInitial('some-mbid', ''), '?');
});

test('buildAvatarInitial returns a single character', () => {
  assert.equal(buildAvatarInitial('some-mbid', 'Massive Attack').length, 1);
});

test('buildAvatarInitial handles null id without throwing', () => {
  assert.doesNotThrow(() => buildAvatarInitial(null, 'Test Artist'));
});

test('buildAvatarInitial matches getArtistAvatar initial field', () => {
  const mbid = '72c536dc-7137-4477-a521-567eeb840fa8';
  assert.equal(buildAvatarInitial(mbid, 'Björk'), getArtistAvatar(mbid, 'Björk').initial);
});
