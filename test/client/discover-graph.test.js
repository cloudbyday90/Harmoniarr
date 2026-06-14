import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSuggestions } from '../../src/client/lib/discover-graph.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSimilar(id, name, score) {
  return { id, name, score, source: 'musicbrainz' };
}

function makeInputResults(entries) {
  return new Map(entries);
}

// ── computeSuggestions ───────────────────────────────────────────────────────

test('computeSuggestions returns an empty array when inputResults is empty', () => {
  const result = computeSuggestions(new Map(), new Set());
  assert.deepEqual(result, []);
});

test('computeSuggestions returns an empty array when all results are excluded', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A', 0.8)]],
  ]);
  const excludeIds = new Set(['artist-a']);
  const result = computeSuggestions(inputResults, excludeIds);
  assert.deepEqual(result, []);
});

test('computeSuggestions excludes recommendation input MBIDs from output', () => {
  const inputResults = makeInputResults([
    ['input-1', [
      makeSimilar('input-1', 'Input 1', 0.9), // same as input — should be excluded
      makeSimilar('artist-b', 'Artist B', 0.7),
    ]],
  ]);
  const excludeIds = new Set(['input-1']);
  const result = computeSuggestions(inputResults, excludeIds);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'artist-b');
});

test('computeSuggestions returns suggestions sorted descending by score', () => {
  const inputResults = makeInputResults([
    ['input-1', [
      makeSimilar('artist-c', 'Artist C', 0.3),
      makeSimilar('artist-a', 'Artist A', 0.9),
      makeSimilar('artist-b', 'Artist B', 0.6),
    ]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.deepEqual(result.map(r => r.id), ['artist-a', 'artist-b', 'artist-c']);
});

test('computeSuggestions respects the limit parameter', () => {
  const results = Array.from({ length: 30 }, (_, i) =>
    makeSimilar(`artist-${i}`, `Artist ${i}`, 1 - i * 0.01),
  );
  const inputResults = makeInputResults([['input-1', results]]);
  const output = computeSuggestions(inputResults, new Set(), 10);
  assert.equal(output.length, 10);
});

test('computeSuggestions uses default limit of 20', () => {
  const results = Array.from({ length: 30 }, (_, i) =>
    makeSimilar(`artist-${i}`, `Artist ${i}`, 1 - i * 0.01),
  );
  const inputResults = makeInputResults([['input-1', results]]);
  const output = computeSuggestions(inputResults, new Set());
  assert.equal(output.length, 20);
});

test('computeSuggestions accumulates scores across inputs for the same artist', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A', 0.6)]],
    ['input-2', [makeSimilar('artist-a', 'Artist A', 0.5)]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'artist-a');
  assert.ok(Math.abs(result[0].score - 1.1) < 1e-9, `expected score ~1.1, got ${result[0].score}`);
});

test('computeSuggestions sets inputCount to 1 for artists from a single input', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A', 0.7)]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.equal(result[0].inputCount, 1);
});

test('computeSuggestions increments inputCount for artists appearing across multiple inputs', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A', 0.6)]],
    ['input-2', [makeSimilar('artist-a', 'Artist A', 0.5)]],
    ['input-3', [makeSimilar('artist-a', 'Artist A', 0.4)]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.equal(result[0].inputCount, 3);
});

test('computeSuggestions ranks multi-input artists higher than single-input artists with lower raw score', () => {
  // artist-shared: 0.4 + 0.4 = 0.8 across 2 inputs
  // artist-solo:   0.75 from 1 input
  // After accumulation: shared=0.8, solo=0.75 → shared should rank first.
  const inputResults = makeInputResults([
    ['input-1', [
      makeSimilar('artist-shared', 'Artist Shared', 0.4),
      makeSimilar('artist-solo', 'Artist Solo', 0.75),
    ]],
    ['input-2', [
      makeSimilar('artist-shared', 'Artist Shared', 0.4),
    ]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.equal(result[0].id, 'artist-shared');
  assert.equal(result[1].id, 'artist-solo');
});

test('computeSuggestions gives a modest ranking boost to artists shared across multiple inputs', () => {
  const inputResults = makeInputResults([
    ['input-1', [
      makeSimilar('artist-shared', 'Artist Shared', 0.4),
      makeSimilar('artist-solo', 'Artist Solo', 0.88),
    ]],
    ['input-2', [
      makeSimilar('artist-shared', 'Artist Shared', 0.4),
    ]],
  ]);

  const result = computeSuggestions(inputResults, new Set());
  assert.equal(result[0].id, 'artist-shared');
  assert.ok(result[0].rankScore > result[1].rankScore);
});

test('computeSuggestions deduplicates artists that appear in multiple inputs', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A', 0.5)]],
    ['input-2', [makeSimilar('artist-a', 'Artist A', 0.5)]],
    ['input-3', [makeSimilar('artist-a', 'Artist A', 0.5)]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'artist-a');
});

test('computeSuggestions preserves artist name from the first encountered entry', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A (first)', 0.5)]],
    ['input-2', [makeSimilar('artist-a', 'Artist A (second)', 0.4)]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.equal(result[0].name, 'Artist A (first)');
});

test('computeSuggestions handles inputs with empty result arrays gracefully', () => {
  const inputResults = makeInputResults([
    ['input-1', []],
    ['input-2', [makeSimilar('artist-a', 'Artist A', 0.7)]],
    ['input-3', []],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'artist-a');
});

test('computeSuggestions does not mutate the inputResults map', () => {
  const original = [makeSimilar('artist-a', 'Artist A', 0.7)];
  const inputResults = makeInputResults([['input-1', original]]);
  computeSuggestions(inputResults, new Set());
  // The original array inside the map should be untouched.
  assert.equal(inputResults.get('input-1'), original);
  assert.equal(inputResults.get('input-1').length, 1);
});

test('computeSuggestions does not mutate the input excludeIds set', () => {
  const excludeIds = new Set(['artist-a']);
  const inputResults = makeInputResults([
    ['input-1', [
      makeSimilar('artist-a', 'Artist A', 0.8),
      makeSimilar('artist-b', 'Artist B', 0.6),
    ]],
  ]);
  computeSuggestions(inputResults, excludeIds);
  assert.equal(excludeIds.size, 1);
  assert.ok(excludeIds.has('artist-a'));
});

test('computeSuggestions includes all result properties in each output item', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A', 0.7)]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  const item = result[0];
  assert.equal(typeof item.id, 'string');
  assert.equal(typeof item.name, 'string');
  assert.equal(typeof item.score, 'number');
  assert.equal(typeof item.inputCount, 'number');
  assert.equal(typeof item.inputBoost, 'number');
  assert.equal(typeof item.rankScore, 'number');
});

test('computeSuggestions exposes the bounded monitored-artist boost', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A', 0.5)]],
    ['input-2', [makeSimilar('artist-a', 'Artist A', 0.5)]],
  ]);
  const result = computeSuggestions(inputResults, new Set());

  assert.equal(result[0].inputBoost, 0.18);
  assert.equal(result[0].rankScore, result[0].score + result[0].inputBoost);
});

test('computeSuggestions returns fewer than limit items when fewer results exist', () => {
  const inputResults = makeInputResults([
    ['input-1', [makeSimilar('artist-a', 'Artist A', 0.7)]],
  ]);
  const result = computeSuggestions(inputResults, new Set(), 20);
  assert.equal(result.length, 1);
});

// ── computeSuggestions: provenance sources ────────────────────────────────────

test('computeSuggestions exposes the source as a sources array', () => {
  const inputResults = makeInputResults([
    ['input-1', [{ id: 'artist-a', name: 'Artist A', score: 0.7, source: 'listenbrainz' }]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.deepEqual(result[0].sources, ['listenbrainz']);
});

test('computeSuggestions aggregates distinct sources across inputs', () => {
  const inputResults = makeInputResults([
    ['input-1', [{ id: 'artist-a', name: 'Artist A', score: 0.5, source: 'musicbrainz' }]],
    ['input-2', [{ id: 'artist-a', name: 'Artist A', score: 0.5, source: 'listenbrainz' }]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.deepEqual(result[0].sources, ['listenbrainz', 'musicbrainz']);
});

test('computeSuggestions de-duplicates repeated sources', () => {
  const inputResults = makeInputResults([
    ['input-1', [{ id: 'artist-a', name: 'Artist A', score: 0.5, source: 'musicbrainz' }]],
    ['input-2', [{ id: 'artist-a', name: 'Artist A', score: 0.5, source: 'musicbrainz' }]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.deepEqual(result[0].sources, ['musicbrainz']);
});

test('computeSuggestions yields an empty sources array when source is missing', () => {
  const inputResults = makeInputResults([
    ['input-1', [{ id: 'artist-a', name: 'Artist A', score: 0.7 }]],
  ]);
  const result = computeSuggestions(inputResults, new Set());
  assert.deepEqual(result[0].sources, []);
});
