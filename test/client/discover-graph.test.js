import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSuggestions } from '../../src/client/lib/discover-graph.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSimilar(id, name, score) {
  return { id, name, score, source: 'musicbrainz' };
}

function makeSeedResults(entries) {
  return new Map(entries);
}

// ── computeSuggestions ───────────────────────────────────────────────────────

test('computeSuggestions returns an empty array when seedResults is empty', () => {
  const result = computeSuggestions(new Map(), new Set());
  assert.deepEqual(result, []);
});

test('computeSuggestions returns an empty array when all results are excluded', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [makeSimilar('artist-a', 'Artist A', 0.8)]],
  ]);
  const excludeIds = new Set(['artist-a']);
  const result = computeSuggestions(seedResults, excludeIds);
  assert.deepEqual(result, []);
});

test('computeSuggestions excludes seed MBIDs from output', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [
      makeSimilar('seed-1', 'Seed 1', 0.9), // same as seed — should be excluded
      makeSimilar('artist-b', 'Artist B', 0.7),
    ]],
  ]);
  const excludeIds = new Set(['seed-1']);
  const result = computeSuggestions(seedResults, excludeIds);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'artist-b');
});

test('computeSuggestions returns suggestions sorted descending by score', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [
      makeSimilar('artist-c', 'Artist C', 0.3),
      makeSimilar('artist-a', 'Artist A', 0.9),
      makeSimilar('artist-b', 'Artist B', 0.6),
    ]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.deepEqual(result.map(r => r.id), ['artist-a', 'artist-b', 'artist-c']);
});

test('computeSuggestions respects the limit parameter', () => {
  const results = Array.from({ length: 30 }, (_, i) =>
    makeSimilar(`artist-${i}`, `Artist ${i}`, 1 - i * 0.01),
  );
  const seedResults = makeSeedResults([['seed-1', results]]);
  const output = computeSuggestions(seedResults, new Set(), 10);
  assert.equal(output.length, 10);
});

test('computeSuggestions uses default limit of 20', () => {
  const results = Array.from({ length: 30 }, (_, i) =>
    makeSimilar(`artist-${i}`, `Artist ${i}`, 1 - i * 0.01),
  );
  const seedResults = makeSeedResults([['seed-1', results]]);
  const output = computeSuggestions(seedResults, new Set());
  assert.equal(output.length, 20);
});

test('computeSuggestions accumulates scores across seeds for the same artist', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [makeSimilar('artist-a', 'Artist A', 0.6)]],
    ['seed-2', [makeSimilar('artist-a', 'Artist A', 0.5)]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'artist-a');
  assert.ok(Math.abs(result[0].score - 1.1) < 1e-9, `expected score ~1.1, got ${result[0].score}`);
});

test('computeSuggestions sets seedCount to 1 for artists from a single seed', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [makeSimilar('artist-a', 'Artist A', 0.7)]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.equal(result[0].seedCount, 1);
});

test('computeSuggestions increments seedCount for artists appearing across multiple seeds', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [makeSimilar('artist-a', 'Artist A', 0.6)]],
    ['seed-2', [makeSimilar('artist-a', 'Artist A', 0.5)]],
    ['seed-3', [makeSimilar('artist-a', 'Artist A', 0.4)]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.equal(result[0].seedCount, 3);
});

test('computeSuggestions ranks multi-seed artists higher than single-seed artists with lower raw score', () => {
  // artist-shared: 0.4 + 0.4 = 0.8 across 2 seeds
  // artist-solo:   0.75 from 1 seed
  // After accumulation: shared=0.8, solo=0.75 → shared should rank first.
  const seedResults = makeSeedResults([
    ['seed-1', [
      makeSimilar('artist-shared', 'Artist Shared', 0.4),
      makeSimilar('artist-solo', 'Artist Solo', 0.75),
    ]],
    ['seed-2', [
      makeSimilar('artist-shared', 'Artist Shared', 0.4),
    ]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.equal(result[0].id, 'artist-shared');
  assert.equal(result[1].id, 'artist-solo');
});

test('computeSuggestions gives a modest ranking boost to artists shared across multiple seeds', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [
      makeSimilar('artist-shared', 'Artist Shared', 0.4),
      makeSimilar('artist-solo', 'Artist Solo', 0.88),
    ]],
    ['seed-2', [
      makeSimilar('artist-shared', 'Artist Shared', 0.4),
    ]],
  ]);

  const result = computeSuggestions(seedResults, new Set());
  assert.equal(result[0].id, 'artist-shared');
  assert.ok(result[0].rankScore > result[1].rankScore);
});

test('computeSuggestions deduplicates artists that appear in multiple seeds', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [makeSimilar('artist-a', 'Artist A', 0.5)]],
    ['seed-2', [makeSimilar('artist-a', 'Artist A', 0.5)]],
    ['seed-3', [makeSimilar('artist-a', 'Artist A', 0.5)]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'artist-a');
});

test('computeSuggestions preserves artist name from the first encountered entry', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [makeSimilar('artist-a', 'Artist A (first)', 0.5)]],
    ['seed-2', [makeSimilar('artist-a', 'Artist A (second)', 0.4)]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.equal(result[0].name, 'Artist A (first)');
});

test('computeSuggestions handles seeds with empty result arrays gracefully', () => {
  const seedResults = makeSeedResults([
    ['seed-1', []],
    ['seed-2', [makeSimilar('artist-a', 'Artist A', 0.7)]],
    ['seed-3', []],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'artist-a');
});

test('computeSuggestions does not mutate the input seedResults map', () => {
  const original = [makeSimilar('artist-a', 'Artist A', 0.7)];
  const seedResults = makeSeedResults([['seed-1', original]]);
  computeSuggestions(seedResults, new Set());
  // The original array inside the map should be untouched.
  assert.equal(seedResults.get('seed-1'), original);
  assert.equal(seedResults.get('seed-1').length, 1);
});

test('computeSuggestions does not mutate the input excludeIds set', () => {
  const excludeIds = new Set(['artist-a']);
  const seedResults = makeSeedResults([
    ['seed-1', [
      makeSimilar('artist-a', 'Artist A', 0.8),
      makeSimilar('artist-b', 'Artist B', 0.6),
    ]],
  ]);
  computeSuggestions(seedResults, excludeIds);
  assert.equal(excludeIds.size, 1);
  assert.ok(excludeIds.has('artist-a'));
});

test('computeSuggestions includes all result properties in each output item', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [makeSimilar('artist-a', 'Artist A', 0.7)]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  const item = result[0];
  assert.equal(typeof item.id, 'string');
  assert.equal(typeof item.name, 'string');
  assert.equal(typeof item.score, 'number');
  assert.equal(typeof item.seedCount, 'number');
  assert.equal(typeof item.rankScore, 'number');
});

test('computeSuggestions returns fewer than limit items when fewer results exist', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [makeSimilar('artist-a', 'Artist A', 0.7)]],
  ]);
  const result = computeSuggestions(seedResults, new Set(), 20);
  assert.equal(result.length, 1);
});

// ── computeSuggestions: provenance sources ────────────────────────────────────

test('computeSuggestions exposes the source as a sources array', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [{ id: 'artist-a', name: 'Artist A', score: 0.7, source: 'listenbrainz' }]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.deepEqual(result[0].sources, ['listenbrainz']);
});

test('computeSuggestions aggregates distinct sources across seeds', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [{ id: 'artist-a', name: 'Artist A', score: 0.5, source: 'musicbrainz' }]],
    ['seed-2', [{ id: 'artist-a', name: 'Artist A', score: 0.5, source: 'listenbrainz' }]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.deepEqual(result[0].sources, ['listenbrainz', 'musicbrainz']);
});

test('computeSuggestions de-duplicates repeated sources', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [{ id: 'artist-a', name: 'Artist A', score: 0.5, source: 'musicbrainz' }]],
    ['seed-2', [{ id: 'artist-a', name: 'Artist A', score: 0.5, source: 'musicbrainz' }]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.deepEqual(result[0].sources, ['musicbrainz']);
});

test('computeSuggestions yields an empty sources array when source is missing', () => {
  const seedResults = makeSeedResults([
    ['seed-1', [{ id: 'artist-a', name: 'Artist A', score: 0.7 }]],
  ]);
  const result = computeSuggestions(seedResults, new Set());
  assert.deepEqual(result[0].sources, []);
});
