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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifySpectralCutoff,
  estimateCutoffFromRolloffSamples,
  isDeclaredLossless,
} from '../../src/server/media/media-spectral-analysis.js';

test('estimateCutoffFromRolloffSamples returns the brightest frame, ignoring noise', () => {
  assert.equal(estimateCutoffFromRolloffSamples([12000, 15500, 19800, 8000]), 19800);
  assert.equal(estimateCutoffFromRolloffSamples([0, -5, NaN, '17000']), 17000);
  assert.equal(estimateCutoffFromRolloffSamples([]), null);
  assert.equal(estimateCutoffFromRolloffSamples('nope'), null);
});

test('classifySpectralCutoff treats a full-spectrum lossless file as authentic', () => {
  const result = classifySpectralCutoff({ cutoffHz: 21000, sampleRate: 44100, declaredLossless: true });
  assert.equal(result.verdict, 'authentic');
  assert.equal(result.penalize, false);
  assert.equal(result.qualityWeight, 1);
});

test('classifySpectralCutoff flags a 16 kHz lossless-claimed file as a high-confidence transcode', () => {
  const result = classifySpectralCutoff({ cutoffHz: 15800, sampleRate: 44100, declaredLossless: true });
  assert.equal(result.verdict, 'transcoded');
  assert.equal(result.penalize, true);
  assert.equal(result.estimatedSourceBitrate, 128);
  assert.ok(result.qualityWeight <= 0.05 + 1e-9);
  assert.ok(result.confidence >= 0.6);
});

test('classifySpectralCutoff flags a ~192 kbps cutoff as a transcode with a lighter weight', () => {
  const result = classifySpectralCutoff({ cutoffHz: 18000, sampleRate: 44100, declaredLossless: true });
  assert.equal(result.verdict, 'transcoded');
  assert.equal(result.penalize, true);
  assert.equal(result.estimatedSourceBitrate, 192);
  assert.ok(Math.abs(result.qualityWeight - 0.15) < 1e-9);
});

test('classifySpectralCutoff marks a borderline 256 kbps cutoff suspicious but not penalized', () => {
  const result = classifySpectralCutoff({ cutoffHz: 19500, sampleRate: 44100, declaredLossless: true });
  assert.equal(result.verdict, 'suspicious');
  assert.equal(result.penalize, false);
  assert.equal(result.estimatedSourceBitrate, 256);
});

test('classifySpectralCutoff never penalizes files that do not claim lossless', () => {
  const result = classifySpectralCutoff({ cutoffHz: 15000, sampleRate: 44100, declaredLossless: false });
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(result.penalize, false);
  assert.equal(result.qualityWeight, 1);
});

test('classifySpectralCutoff is inconclusive below the reliable sample-rate threshold', () => {
  const result = classifySpectralCutoff({ cutoffHz: 14000, sampleRate: 22050, declaredLossless: true });
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(result.penalize, false);
});

test('classifySpectralCutoff is inconclusive without a usable measurement', () => {
  const result = classifySpectralCutoff({ cutoffHz: null, sampleRate: 44100, declaredLossless: true });
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(result.penalize, false);
});

test('isDeclaredLossless recognizes lossless codecs and extensions', () => {
  assert.equal(isDeclaredLossless({ codec: 'flac' }), true);
  assert.equal(isDeclaredLossless({ codec: 'pcm_s24le' }), true);
  assert.equal(isDeclaredLossless({ extension: '.flac' }), true);
  assert.equal(isDeclaredLossless({ extension: 'alac' }), true);
  assert.equal(isDeclaredLossless({ codec: 'mp3', extension: '.mp3' }), false);
  assert.equal(isDeclaredLossless({}), false);
});
