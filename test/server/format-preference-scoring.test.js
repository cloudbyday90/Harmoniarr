import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFormatSearchTerm,
  isQualityAboveMinimum,
  scoreCandidateFormatMatch,
} from '../../src/server/library/format-preference-scoring.js';

test('buildFormatSearchTerm returns null for any', () => {
  assert.equal(buildFormatSearchTerm('any'), null);
});

test('buildFormatSearchTerm returns null for undefined', () => {
  assert.equal(buildFormatSearchTerm(undefined), null);
});

test('buildFormatSearchTerm returns null for null', () => {
  assert.equal(buildFormatSearchTerm(null), null);
});

test('buildFormatSearchTerm returns FLAC for flac', () => {
  assert.equal(buildFormatSearchTerm('flac'), 'FLAC');
});

test('buildFormatSearchTerm returns 320 for mp3_320', () => {
  assert.equal(buildFormatSearchTerm('mp3_320'), '320');
});

test('buildFormatSearchTerm returns V0 for mp3_v0', () => {
  assert.equal(buildFormatSearchTerm('mp3_v0'), 'V0');
});

test('buildFormatSearchTerm returns null for unknown format', () => {
  assert.equal(buildFormatSearchTerm('wav'), null);
});

test('isQualityAboveMinimum returns true when minimumQuality is any', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: 'any', extension: 'mp3', bitRateKbps: 128 }), true);
});

test('isQualityAboveMinimum returns true when minimumQuality is null', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: null, extension: 'mp3', bitRateKbps: 128 }), true);
});

test('isQualityAboveMinimum returns true for lossless minimum with flac extension', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: 'lossless', extension: 'flac', bitRateKbps: null }), true);
});

test('isQualityAboveMinimum returns true for lossless minimum with wav extension', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: 'lossless', extension: 'wav', bitRateKbps: null }), true);
});

test('isQualityAboveMinimum returns false for lossless minimum with mp3 extension', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: 'lossless', extension: 'mp3', bitRateKbps: 320 }), false);
});

test('isQualityAboveMinimum returns true for high minimum with flac extension', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: 'high', extension: 'flac', bitRateKbps: null }), true);
});

test('isQualityAboveMinimum returns true for high minimum with mp3 320', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: 'high', extension: 'mp3', bitRateKbps: 320 }), true);
});

test('isQualityAboveMinimum returns false for high minimum with mp3 192', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: 'high', extension: 'mp3', bitRateKbps: 192 }), false);
});

test('isQualityAboveMinimum is case-insensitive on extension', () => {
  assert.equal(isQualityAboveMinimum({ minimumQuality: 'lossless', extension: 'FLAC', bitRateKbps: null }), true);
});

test('scoreCandidateFormatMatch returns score 100 when both preferences are any', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'any',
    minimumQuality: 'any',
    extensions: ['mp3'],
    files: [],
  });
  assert.equal(result.score, 100);
  assert.equal(result.matches, true);
  assert.equal(result.label, null);
});

test('scoreCandidateFormatMatch returns score 100 for exact FLAC match', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'flac',
    minimumQuality: 'any',
    extensions: ['flac'],
    files: [{ extension: 'flac', bitRateKbps: null }],
  });
  assert.equal(result.score, 100);
  assert.equal(result.matches, true);
  assert.equal(result.label, 'Format match');
});

test('scoreCandidateFormatMatch returns score 100 for mp3_320 match', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'mp3_320',
    minimumQuality: 'any',
    extensions: ['mp3'],
    files: [{ extension: 'mp3', bitRateKbps: 320 }],
  });
  assert.equal(result.score, 100);
  assert.equal(result.label, 'Format match');
});

test('scoreCandidateFormatMatch returns score 60 when lossy preferred but lossless available', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'mp3_320',
    minimumQuality: 'any',
    extensions: ['flac'],
    files: [{ extension: 'flac', bitRateKbps: null }],
  });
  assert.equal(result.score, 60);
  assert.equal(result.label, 'Higher quality available');
});

test('scoreCandidateFormatMatch returns score 40 when lossless preferred but lossy available', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'flac',
    minimumQuality: 'any',
    extensions: ['mp3'],
    files: [{ extension: 'mp3', bitRateKbps: 320 }],
  });
  assert.equal(result.score, 40);
  assert.equal(result.label, 'Lossy alternative');
});

test('scoreCandidateFormatMatch returns score 0 when below quality floor', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'any',
    minimumQuality: 'lossless',
    extensions: ['mp3'],
    files: [{ extension: 'mp3', bitRateKbps: 320 }],
  });
  assert.equal(result.score, 0);
  assert.equal(result.matches, false);
  assert.equal(result.label, 'Below quality floor');
});

test('scoreCandidateFormatMatch returns score 0 for no extensions', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'flac',
    minimumQuality: 'any',
    extensions: [],
    files: [],
  });
  assert.equal(result.score, 0);
  assert.equal(result.label, 'Unknown format');
});

test('scoreCandidateFormatMatch returns score 100 when minimumQuality met and format is any', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'any',
    minimumQuality: 'high',
    extensions: ['flac'],
    files: [{ extension: 'flac', bitRateKbps: null }],
  });
  assert.equal(result.score, 100);
  assert.equal(result.label, null);
});

test('scoreCandidateFormatMatch handles mixed extensions', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'flac',
    minimumQuality: 'any',
    extensions: ['mp3', 'flac', 'txt'],
    files: [
      { extension: 'mp3', bitRateKbps: 320 },
      { extension: 'flac', bitRateKbps: null },
    ],
  });
  assert.equal(result.score, 100);
  assert.equal(result.label, 'Format match');
});

test('scoreCandidateFormatMatch with minimumQuality high and mp3 320 meets floor', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'flac',
    minimumQuality: 'high',
    extensions: ['mp3'],
    files: [{ extension: 'mp3', bitRateKbps: 320 }],
  });
  assert.equal(result.score, 40);
  assert.equal(result.matches, true);
  assert.equal(result.label, 'Lossy alternative');
});

test('scoreCandidateFormatMatch with minimumQuality lossless rejects mp3 320', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: 'any',
    minimumQuality: 'lossless',
    extensions: ['mp3'],
    files: [{ extension: 'mp3', bitRateKbps: 320 }],
  });
  assert.equal(result.score, 0);
  assert.equal(result.matches, false);
});

test('scoreCandidateFormatMatch with undefined preferences returns 100', () => {
  const result = scoreCandidateFormatMatch({
    preferredFormat: undefined,
    minimumQuality: undefined,
    extensions: ['mp3'],
    files: [],
  });
  assert.equal(result.score, 100);
  assert.equal(result.matches, true);
});

test('scoreCandidateFormatMatch with default empty arguments returns 100', () => {
  const result = scoreCandidateFormatMatch({});
  assert.equal(result.score, 100);
  assert.equal(result.matches, true);
});
