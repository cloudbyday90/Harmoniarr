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
import { parseSlskdWebhookEvent } from '../../src/server/integrations/slskd/slskd-webhook-event.js';

const now = new Date('2026-06-26T12:00:00.000Z');

test('parseSlskdWebhookEvent accepts a download file complete event', () => {
  const event = parseSlskdWebhookEvent({
    id: '7f1c2d3e-aaaa-bbbb-cccc-1234567890ab',
    type: 'DownloadFileComplete',
    version: '0',
    timestamp: '2026-06-26T11:59:30.000Z',
    remoteFilename: 'evil\\song"; rm -rf /; echo ".flac',
    transfer: { id: 'transfer-1', state: 'Completed, Succeeded' },
  }, { now });

  assert.deepEqual(event, {
    actionable: true,
    eventType: 'download_file_complete',
    id: '7f1c2d3e-aaaa-bbbb-cccc-1234567890ab',
    reason: null,
    timestamp: '2026-06-26T11:59:30.000Z',
    version: '0',
  });
  // The hostile remoteFilename must never be surfaced in the trusted descriptor.
  assert.equal(Object.values(event).some((value) => String(value).includes('rm -rf')), false);
});

test('parseSlskdWebhookEvent accepts PascalCase field names', () => {
  const event = parseSlskdWebhookEvent({
    Id: 'abc',
    Type: 'DownloadDirectoryComplete',
    Version: '1',
  }, { now });
  assert.equal(event.actionable, true);
  assert.equal(event.eventType, 'download_directory_complete');
  assert.equal(event.id, 'abc');
});

test('parseSlskdWebhookEvent marks unknown event types as non-actionable', () => {
  const event = parseSlskdWebhookEvent({
    id: 'x',
    type: 'UploadFileComplete',
  }, { now });
  assert.equal(event.actionable, false);
  assert.equal(event.reason, 'unsupported_event_type');
  assert.equal(event.eventType, 'uploadfilecomplete');
});

test('parseSlskdWebhookEvent marks stale events as non-actionable (replay defense)', () => {
  const event = parseSlskdWebhookEvent({
    id: 'stale-1',
    type: 'DownloadFileComplete',
    timestamp: '2026-06-20T00:00:00.000Z',
  }, { now, maxClockSkewMs: 60 * 1000 });
  assert.equal(event.actionable, false);
  assert.equal(event.reason, 'stale_event');
});

test('parseSlskdWebhookEvent tolerates an unparseable timestamp by dropping it', () => {
  const event = parseSlskdWebhookEvent({
    id: 'ts-bad',
    type: 'DownloadFileComplete',
    timestamp: 'not-a-date',
  }, { now });
  assert.equal(event.actionable, true);
  assert.equal(event.timestamp, null);
});

test('parseSlskdWebhookEvent rejects non-object payloads', () => {
  for (const payload of [null, undefined, 'string', 42, ['array']]) {
    assert.throws(() => parseSlskdWebhookEvent(payload, { now }), (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'slskd_webhook_invalid_payload');
      return true;
    });
  }
});

test('parseSlskdWebhookEvent rejects missing id and type', () => {
  assert.throws(() => parseSlskdWebhookEvent({ type: 'DownloadFileComplete' }, { now }), (error) => {
    assert.equal(error.code, 'slskd_webhook_invalid_payload');
    return true;
  });
  assert.throws(() => parseSlskdWebhookEvent({ id: 'a' }, { now }), (error) => {
    assert.equal(error.code, 'slskd_webhook_invalid_payload');
    return true;
  });
});

test('parseSlskdWebhookEvent rejects control characters and oversized identifiers', () => {
  assert.throws(() => parseSlskdWebhookEvent({ id: 'bad\u0000id', type: 'DownloadFileComplete' }, { now }), (error) => {
    assert.equal(error.code, 'slskd_webhook_invalid_payload');
    return true;
  });
  assert.throws(() => parseSlskdWebhookEvent({ id: 'a'.repeat(201), type: 'DownloadFileComplete' }, { now }), (error) => {
    assert.equal(error.code, 'slskd_webhook_invalid_payload');
    return true;
  });
});
