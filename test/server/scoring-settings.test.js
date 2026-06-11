import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SCORING_WEIGHTS,
  buildScorersFromWeights,
  resolveScoringSettings,
} from '../../src/server/library/download-result-scoring.js';

test('DEFAULT_SCORING_WEIGHTS has expected frozen values', () => {
  assert.equal(DEFAULT_SCORING_WEIGHTS.weightFormatTier, 0.25);
  assert.equal(DEFAULT_SCORING_WEIGHTS.weightCandidateTrackMatch, 0.20);
  assert.equal(DEFAULT_SCORING_WEIGHTS.weightAudioDepth, 0.12);
  assert.equal(DEFAULT_SCORING_WEIGHTS.weightDuration, 0.12);
  assert.equal(DEFAULT_SCORING_WEIGHTS.weightFormatConsistency, 0.10);
  assert.equal(DEFAULT_SCORING_WEIGHTS.weightTrackCount, 0.08);
  assert.equal(DEFAULT_SCORING_WEIGHTS.weightPeerDelivery, 0.08);
  assert.equal(DEFAULT_SCORING_WEIGHTS.weightUploaderReputation, 0.05);
  assert.ok(Object.isFrozen(DEFAULT_SCORING_WEIGHTS));
});

test('resolveScoringSettings returns default scorers when called with no arguments', () => {
  const scorers = resolveScoringSettings();

  assert.equal(scorers.length, 8);
  assert.equal(scorers[0].name, 'formatTier');
  assert.equal(scorers[0].weight, DEFAULT_SCORING_WEIGHTS.weightFormatTier);
});

test('resolveScoringSettings returns default scorers when called with null', () => {
  const scorers = resolveScoringSettings(null);

  assert.equal(scorers[0].weight, DEFAULT_SCORING_WEIGHTS.weightFormatTier);
});

test('resolveScoringSettings returns default scorers when called with undefined', () => {
  const scorers = resolveScoringSettings(undefined);

  assert.equal(scorers[0].weight, DEFAULT_SCORING_WEIGHTS.weightFormatTier);
});

test('resolveScoringSettings returns default scorers for empty object', () => {
  const scorers = resolveScoringSettings({});

  assert.equal(scorers[0].weight, DEFAULT_SCORING_WEIGHTS.weightFormatTier);
  assert.equal(scorers[7].weight, DEFAULT_SCORING_WEIGHTS.weightUploaderReputation);
});

test('resolveScoringSettings returns default scorers when scoring namespace is missing', () => {
  const scorers = resolveScoringSettings({ library: { discoveryBatchSize: 5 } });

  assert.equal(scorers[0].weight, DEFAULT_SCORING_WEIGHTS.weightFormatTier);
});

test('resolveScoringSettings resolves valid weights from scoring namespace', () => {
  const scorers = resolveScoringSettings({
    scoring: {
      weightFormatTier: 0.30,
      weightCandidateTrackMatch: 0.15,
      weightAudioDepth: 0.10,
      weightDuration: 0.10,
      weightFormatConsistency: 0.12,
      weightTrackCount: 0.08,
      weightPeerDelivery: 0.10,
      weightUploaderReputation: 0.05,
    },
  });

  assert.equal(scorers[0].weight, 0.30);
  assert.equal(scorers[1].weight, 0.15);
  assert.equal(scorers[2].weight, 0.10);
});

test('resolveScoringSettings falls back to defaults for partial settings', () => {
  const scorers = resolveScoringSettings({
    scoring: {
      weightFormatTier: 0.40,
    },
  });

  assert.equal(scorers[0].weight, 0.40);
  assert.equal(scorers[1].weight, DEFAULT_SCORING_WEIGHTS.weightCandidateTrackMatch);
  assert.equal(scorers[7].weight, DEFAULT_SCORING_WEIGHTS.weightUploaderReputation);
});

test('resolveScoringSettings falls back to defaults for non-numeric values', () => {
  const scorers = resolveScoringSettings({
    scoring: {
      weightFormatTier: 'high',
      weightCandidateTrackMatch: NaN,
      weightAudioDepth: Infinity,
      weightDuration: -0.1,
      weightFormatConsistency: 0,
      weightTrackCount: null,
      weightPeerDelivery: undefined,
      weightUploaderReputation: {},
    },
  });

  assert.equal(scorers[0].weight, DEFAULT_SCORING_WEIGHTS.weightFormatTier);
  assert.equal(scorers[1].weight, DEFAULT_SCORING_WEIGHTS.weightCandidateTrackMatch);
  assert.equal(scorers[2].weight, DEFAULT_SCORING_WEIGHTS.weightAudioDepth);
  assert.equal(scorers[3].weight, DEFAULT_SCORING_WEIGHTS.weightDuration);
  assert.equal(scorers[4].weight, DEFAULT_SCORING_WEIGHTS.weightFormatConsistency);
  assert.equal(scorers[5].weight, DEFAULT_SCORING_WEIGHTS.weightTrackCount);
  assert.equal(scorers[6].weight, DEFAULT_SCORING_WEIGHTS.weightPeerDelivery);
  assert.equal(scorers[7].weight, DEFAULT_SCORING_WEIGHTS.weightUploaderReputation);
});

test('resolveScoringSettings ignores non-object scoring namespace', () => {
  const scorers = resolveScoringSettings({ scoring: 'invalid' });

  assert.equal(scorers[0].weight, DEFAULT_SCORING_WEIGHTS.weightFormatTier);
});

test('resolveScoringSettings resolves all eight weights when all are valid', () => {
  const scorers = resolveScoringSettings({
    scoring: {
      weightFormatTier: 0.35,
      weightCandidateTrackMatch: 0.18,
      weightAudioDepth: 0.11,
      weightDuration: 0.11,
      weightFormatConsistency: 0.09,
      weightTrackCount: 0.07,
      weightPeerDelivery: 0.06,
      weightUploaderReputation: 0.03,
    },
  });

  assert.equal(scorers.length, 8);
  assert.equal(scorers[0].weight, 0.35);
  assert.equal(scorers[1].weight, 0.18);
  assert.equal(scorers[2].weight, 0.11);
  assert.equal(scorers[3].weight, 0.11);
  assert.equal(scorers[4].weight, 0.09);
  assert.equal(scorers[5].weight, 0.07);
  assert.equal(scorers[6].weight, 0.06);
  assert.equal(scorers[7].weight, 0.03);
});

test('buildScorersFromWeights pairs weights with scorer functions', () => {
  const scorers = buildScorersFromWeights(DEFAULT_SCORING_WEIGHTS);

  assert.equal(scorers.length, 8);
  const names = scorers.map((s) => s.name);
  assert.deepEqual(names, [
    'formatTier',
    'candidateTrackMatch',
    'audioDepth',
    'duration',
    'formatConsistency',
    'trackCount',
    'peerDelivery',
    'uploaderReputation',
  ]);
  for (const scorer of scorers) {
    assert.equal(typeof scorer.fn, 'function');
    assert.equal(typeof scorer.weight, 'number');
  }
});

test('resolveScoringSettings produces identical scorers to DEFAULT_SCORERS when settings are absent', () => {
  const defaultScorers = buildScorersFromWeights(DEFAULT_SCORING_WEIGHTS);
  const resolved = resolveScoringSettings(undefined);

  const defaultWeights = defaultScorers.map((s) => s.weight);
  const resolvedWeights = resolved.map((s) => s.weight);
  assert.deepEqual(resolvedWeights, defaultWeights);
});
