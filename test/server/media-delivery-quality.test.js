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
  assessDeliveredQuality,
  assessFileDeliveryQuality,
} from '../../src/server/media/media-delivery-quality.js';

const authenticTags = { album: 'Album', artist: 'Artist', title: 'Title' };

test('assessFileDeliveryQuality returns no penalty for an authentic lossless FLAC', () => {
  const result = assessFileDeliveryQuality({
    filename: 'track.flac',
    metadata: {
      primaryAudioCodec: 'flac',
      bitRate: 900_000,
      sampleRate: 44_100,
      bitDepth: 16,
      channelCount: 2,
      tags: authenticTags,
    },
  });

  assert.equal(result.penalty, 0);
  assert.deepEqual(result.signals, []);
});

test('assessFileDeliveryQuality flags codec/extension mismatch (fake FLAC)', () => {
  const result = assessFileDeliveryQuality({
    filename: 'fake.flac',
    metadata: {
      primaryAudioCodec: 'mp3',
      bitRate: 320_000,
      tags: authenticTags,
    },
  });

  assert.ok(result.signals.includes('codec_extension_mismatch'));
  assert.equal(result.penalty, 0.6);
});

test('assessFileDeliveryQuality flags a lossless container compressing implausibly small', () => {
  const result = assessFileDeliveryQuality({
    filename: 'transcoded.flac',
    metadata: {
      primaryAudioCodec: 'flac',
      // 16-bit/44.1kHz stereo uncompressed ~= 1.41 Mbps; 300kbps is ~21% (< 30%).
      bitRate: 300_000,
      sampleRate: 44_100,
      bitDepth: 16,
      channelCount: 2,
      tags: authenticTags,
    },
  });

  assert.ok(result.signals.includes('lossless_low_bitrate'));
  assert.equal(result.penalty, 0.4);
});

test('assessFileDeliveryQuality flags low-bitrate lossy and incomplete tags', () => {
  const result = assessFileDeliveryQuality({
    filename: 'low.mp3',
    metadata: {
      primaryAudioCodec: 'mp3',
      bitRate: 128_000,
      tags: { title: 'Title' },
    },
  });

  assert.ok(result.signals.includes('low_bitrate'));
  assert.ok(result.signals.includes('incomplete_tags'));
  assert.equal(result.penalty, 0.2 + 0.1);
});

test('assessFileDeliveryQuality produces no signals when metadata is missing', () => {
  const result = assessFileDeliveryQuality({ filename: 'track.flac', metadata: null });
  assert.deepEqual(result, { penalty: 0, signals: [], labels: [] });
});

test('assessFileDeliveryQuality does not treat .m4a extension alone as a lossless promise', () => {
  const result = assessFileDeliveryQuality({
    filename: 'track.m4a',
    metadata: {
      primaryAudioCodec: 'aac',
      bitRate: 256_000,
      tags: authenticTags,
    },
  });

  assert.ok(!result.signals.includes('codec_extension_mismatch'));
  assert.equal(result.penalty, 0);
});

test('assessDeliveredQuality takes the max per-file penalty and unions signals', () => {
  const result = assessDeliveredQuality({
    files: [
      {
        filename: 'clean.flac',
        inspection: {
          metadata: {
            primaryAudioCodec: 'flac',
            bitRate: 900_000,
            sampleRate: 44_100,
            bitDepth: 16,
            channelCount: 2,
            tags: authenticTags,
          },
        },
      },
      {
        filename: 'fake.flac',
        inspection: {
          metadata: {
            primaryAudioCodec: 'mp3',
            bitRate: 320_000,
            tags: { title: 'Only title' },
          },
        },
      },
    ],
  });

  assert.equal(result.assessedFileCount, 2);
  assert.equal(result.penaltyWeight, 0.7);
  assert.ok(result.signals.includes('codec_extension_mismatch'));
  assert.ok(result.signals.includes('incomplete_tags'));
});

test('assessDeliveredQuality ignores files without inspection metadata', () => {
  const result = assessDeliveredQuality({
    files: [
      { filename: 'unknown.flac' },
      { filename: 'unknown.mp3', inspection: { metadata: null } },
    ],
  });

  assert.equal(result.assessedFileCount, 0);
  assert.equal(result.penaltyWeight, 0);
  assert.deepEqual(result.signals, []);
});

test('assessDeliveredQuality returns an empty assessment for no files', () => {
  const result = assessDeliveredQuality({});
  assert.deepEqual(result, {
    penaltyWeight: 0,
    labels: [],
    signals: [],
    assessedFileCount: 0,
  });
});
