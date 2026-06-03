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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSparklineEndpoint,
  buildSparklinePath,
  formatQualityAverage,
  formatSignalLabel,
  formatTrendCharacterization,
  formatTrendLabel,
  formatTrendTone,
} from '../../src/client/lib/source-user-quality-trend-presentation.js';

describe('buildSparklinePath', () => {
  it('returns an empty string for an empty or missing series', () => {
    assert.equal(buildSparklinePath({ series: [] }), '');
    assert.equal(buildSparklinePath({ series: null }), '');
  });

  it('draws a flat line for a single point', () => {
    const path = buildSparklinePath({ series: [{ qualityWeight: 0.5 }], width: 100, height: 40, padding: 0 });
    assert.match(path, /^M 0,20 L 100,20$/);
  });

  it('maps higher quality to a higher (smaller y) position', () => {
    const path = buildSparklinePath({
      series: [{ qualityWeight: 0 }, { qualityWeight: 1 }],
      width: 100,
      height: 40,
      padding: 0,
    });
    // First point (quality 0) sits at the bottom (y=40); last (quality 1) at top (y=0).
    assert.match(path, /M 0,40/);
    assert.match(path, /L 100,0/);
  });
});

describe('buildSparklineEndpoint', () => {
  it('returns the final point coordinates', () => {
    const endpoint = buildSparklineEndpoint({
      series: [{ qualityWeight: 1 }, { qualityWeight: 0 }],
      width: 100,
      height: 40,
      padding: 0,
    });
    assert.deepEqual(endpoint, { x: 100, y: 40 });
  });

  it('returns null for an empty series', () => {
    assert.equal(buildSparklineEndpoint({ series: [] }), null);
  });
});

describe('trend label and tone', () => {
  it('maps directions to labels and tones', () => {
    assert.equal(formatTrendLabel('degrading'), 'Degrading');
    assert.equal(formatTrendTone('degrading'), 'danger');
    assert.equal(formatTrendLabel('improving'), 'Improving');
    assert.equal(formatTrendTone('improving'), 'success');
    assert.equal(formatTrendLabel('weird'), 'Unknown');
    assert.equal(formatTrendTone('weird'), 'neutral');
  });
});

describe('formatTrendCharacterization', () => {
  it('distinguishes degraded-recently from always-poor', () => {
    assert.match(formatTrendCharacterization({ sampleCount: 5, degradedRecently: true }), /Recently degraded/);
    assert.match(formatTrendCharacterization({ sampleCount: 5, alwaysPoor: true }), /Consistently poor/);
    assert.match(formatTrendCharacterization({ sampleCount: 0 }), /No delivered-quality evidence/);
    assert.equal(formatTrendCharacterization(null), null);
  });
});

describe('formatQualityAverage and formatSignalLabel', () => {
  it('formats averages as percentages', () => {
    assert.equal(formatQualityAverage(0.5), '50%');
    assert.equal(formatQualityAverage(null), '—');
  });

  it('humanizes known and unknown signal labels', () => {
    assert.equal(formatSignalLabel('spectral_transcode_confirmed'), 'Spectral transcode confirmed');
    assert.equal(formatSignalLabel('lossless_low_bitrate'), 'Lossless under-bitrate');
    assert.equal(formatSignalLabel('some_other_signal'), 'Some Other Signal');
    assert.equal(formatSignalLabel(''), 'Unknown signal');
  });
});
