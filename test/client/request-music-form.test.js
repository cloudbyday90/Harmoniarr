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
  buildMediaRequestPayload,
  buildMediaRequestSuccessMessage,
  formatRequestEventDescription,
  formatReassignmentEventDescription,
  getCancelToastMessage,
  getFulfillmentStatusLabel,
  getFulfillmentStatusTone,
  getRequestEventLabel,
  getRequestEventTone,
  getReassignmentEventLabel,
  getReassignmentEventTone,
  getRequestHeadline,
  getRequestKindLabel,
  getRequestStateLabel,
  getRequestTargetLabel,
} from '../../src/client/lib/request-music-form.js';

// ---------------------------------------------------------------------------
// getRequestKindLabel
// ---------------------------------------------------------------------------

test('getRequestKindLabel returns Release request for release kind', () => {
  assert.equal(getRequestKindLabel('release'), 'Release request');
});

test('getRequestKindLabel returns Track request for track kind', () => {
  assert.equal(getRequestKindLabel('track'), 'Track request');
});

test('getRequestKindLabel returns Playlist or collection URL for external_url kind', () => {
  assert.equal(getRequestKindLabel('external_url'), 'Playlist or collection URL');
});

test('getRequestKindLabel returns Release request for unknown kind', () => {
  assert.equal(getRequestKindLabel('unknown'), 'Release request');
});

test('getRequestKindLabel returns Release request for undefined', () => {
  assert.equal(getRequestKindLabel(undefined), 'Release request');
});

// ---------------------------------------------------------------------------
// getRequestHeadline
// ---------------------------------------------------------------------------

test('getRequestHeadline returns em-dash separated artist and release for release kind', () => {
  const request = { requestKind: 'release', artistName: 'Daft Punk', releaseTitle: 'Discovery' };
  assert.equal(getRequestHeadline(request), 'Daft Punk \u2014 Discovery');
});

test('getRequestHeadline returns em-dash separated artist and track for track kind', () => {
  const request = { requestKind: 'track', artistName: 'Daft Punk', trackTitle: 'One More Time' };
  assert.equal(getRequestHeadline(request), 'Daft Punk \u2014 One More Time');
});

test('getRequestHeadline returns sourceUrl for external_url kind', () => {
  const request = { requestKind: 'external_url', sourceUrl: 'https://open.spotify.com/playlist/abc' };
  assert.equal(getRequestHeadline(request), 'https://open.spotify.com/playlist/abc');
});

test('getRequestHeadline returns empty string for external_url with no sourceUrl', () => {
  const request = { requestKind: 'external_url' };
  assert.equal(getRequestHeadline(request), '');
});

test('getRequestHeadline handles missing artistName gracefully', () => {
  const request = { requestKind: 'release', releaseTitle: 'Discovery' };
  assert.equal(getRequestHeadline(request), ' \u2014 Discovery');
});

// ---------------------------------------------------------------------------
// getRequestStateLabel
// ---------------------------------------------------------------------------

test('getRequestStateLabel returns Already exists for already_exists', () => {
  assert.equal(getRequestStateLabel('already_exists'), 'Already exists');
});

test('getRequestStateLabel returns Needs review for needs_review', () => {
  assert.equal(getRequestStateLabel('needs_review'), 'Needs review');
});

test('getRequestStateLabel returns Needs fetch for needs_fetch', () => {
  assert.equal(getRequestStateLabel('needs_fetch'), 'Needs fetch');
});

test('getRequestStateLabel returns Needs fetch for unknown state', () => {
  assert.equal(getRequestStateLabel('pending'), 'Needs fetch');
});

test('getRequestStateLabel returns Needs fetch for undefined', () => {
  assert.equal(getRequestStateLabel(undefined), 'Needs fetch');
});

// ---------------------------------------------------------------------------
// getFulfillmentStatusTone
// ---------------------------------------------------------------------------

test('getFulfillmentStatusTone returns success for selected tone', () => {
  assert.equal(getFulfillmentStatusTone({ tone: 'selected' }), 'success');
});

test('getFulfillmentStatusTone returns danger for failed tone', () => {
  assert.equal(getFulfillmentStatusTone({ tone: 'failed' }), 'danger');
});

test('getFulfillmentStatusTone returns info for other tone', () => {
  assert.equal(getFulfillmentStatusTone({ tone: 'queued' }), 'info');
});

test('getFulfillmentStatusTone returns info for null fulfillmentStatus', () => {
  assert.equal(getFulfillmentStatusTone(null), 'info');
});

test('getFulfillmentStatusTone returns info for undefined fulfillmentStatus', () => {
  assert.equal(getFulfillmentStatusTone(undefined), 'info');
});

// ---------------------------------------------------------------------------
// getFulfillmentStatusLabel
// ---------------------------------------------------------------------------

test('getFulfillmentStatusLabel returns the label property when present', () => {
  assert.equal(getFulfillmentStatusLabel({ label: 'Downloading', tone: 'info' }), 'Downloading');
});

test('getFulfillmentStatusLabel returns Queued for null', () => {
  assert.equal(getFulfillmentStatusLabel(null), 'Queued');
});

test('getFulfillmentStatusLabel returns Queued for undefined', () => {
  assert.equal(getFulfillmentStatusLabel(undefined), 'Queued');
});

test('getFulfillmentStatusLabel returns Queued for object with no label', () => {
  assert.equal(getFulfillmentStatusLabel({ tone: 'info' }), 'Queued');
});

// ---------------------------------------------------------------------------
// getRequestTargetLabel
// ---------------------------------------------------------------------------

test('getRequestTargetLabel returns username and role with you marker for current user', () => {
  const user = { id: 'u1', username: 'alice', role: 'admin' };
  assert.equal(getRequestTargetLabel(user, 'u1'), 'alice (Admin, you)');
});

test('getRequestTargetLabel returns username and role without you marker for other user', () => {
  const user = { id: 'u2', username: 'bob', role: 'requester' };
  assert.equal(getRequestTargetLabel(user, 'u1'), 'bob (Requester)');
});

test('getRequestTargetLabel returns empty string for null user', () => {
  assert.equal(getRequestTargetLabel(null, 'u1'), '');
});

test('getRequestTargetLabel returns empty string for undefined user', () => {
  assert.equal(getRequestTargetLabel(undefined, 'u1'), '');
});

// ---------------------------------------------------------------------------
// buildMediaRequestPayload
// ---------------------------------------------------------------------------

test('buildMediaRequestPayload builds release payload with required fields', () => {
  const form = {
    artistName: 'Daft Punk',
    notes: '',
    releaseTitle: 'Discovery',
    requestKind: 'release',
    requestedForUserId: '',
    sourceUrl: '',
    trackTitle: '',
  };
  const result = buildMediaRequestPayload({ form, isAdmin: false });
  assert.deepEqual(result, {
    notes: '',
    requestKind: 'release',
    artistName: 'Daft Punk',
    releaseTitle: 'Discovery',
  });
});

test('buildMediaRequestPayload builds track payload with track and release fields', () => {
  const form = {
    artistName: 'Daft Punk',
    notes: 'please',
    releaseTitle: 'Discovery',
    requestKind: 'track',
    requestedForUserId: '',
    sourceUrl: '',
    trackTitle: 'One More Time',
  };
  const result = buildMediaRequestPayload({ form, isAdmin: false });
  assert.deepEqual(result, {
    notes: 'please',
    requestKind: 'track',
    artistName: 'Daft Punk',
    trackTitle: 'One More Time',
    releaseTitle: 'Discovery',
  });
});

test('buildMediaRequestPayload builds external_url payload with sourceUrl only', () => {
  const form = {
    artistName: '',
    notes: '',
    releaseTitle: '',
    requestKind: 'external_url',
    requestedForUserId: '',
    sourceUrl: 'https://open.spotify.com/playlist/abc',
    trackTitle: '',
  };
  const result = buildMediaRequestPayload({ form, isAdmin: false });
  assert.deepEqual(result, {
    notes: '',
    requestKind: 'external_url',
    sourceUrl: 'https://open.spotify.com/playlist/abc',
  });
});

test('buildMediaRequestPayload includes requestedForUserId when admin and userId set', () => {
  const form = {
    artistName: 'Daft Punk',
    notes: '',
    releaseTitle: 'Discovery',
    requestKind: 'release',
    requestedForUserId: 'user-99',
    sourceUrl: '',
    trackTitle: '',
  };
  const result = buildMediaRequestPayload({ form, isAdmin: true });
  assert.equal(result.requestedForUserId, 'user-99');
});

test('buildMediaRequestPayload omits requestedForUserId when not admin', () => {
  const form = {
    artistName: 'Daft Punk',
    notes: '',
    releaseTitle: 'Discovery',
    requestKind: 'release',
    requestedForUserId: 'user-99',
    sourceUrl: '',
    trackTitle: '',
  };
  const result = buildMediaRequestPayload({ form, isAdmin: false });
  assert.equal('requestedForUserId' in result, false);
});

test('buildMediaRequestPayload omits requestedForUserId when admin but no userId', () => {
  const form = {
    artistName: 'Daft Punk',
    notes: '',
    releaseTitle: 'Discovery',
    requestKind: 'release',
    requestedForUserId: '',
    sourceUrl: '',
    trackTitle: '',
  };
  const result = buildMediaRequestPayload({ form, isAdmin: true });
  assert.equal('requestedForUserId' in result, false);
});

// ---------------------------------------------------------------------------
// buildMediaRequestSuccessMessage
// ---------------------------------------------------------------------------

test('buildMediaRequestSuccessMessage returns profile message for own request', () => {
  const mediaRequest = {
    requestState: 'needs_fetch',
    requestedForUser: { id: 'u1', username: 'alice' },
  };
  const result = buildMediaRequestSuccessMessage(mediaRequest, 'u1');
  assert.equal(result, 'Music request submitted and added to your request profile.');
});

test('buildMediaRequestSuccessMessage returns delegated message when target differs', () => {
  const mediaRequest = {
    requestState: 'needs_fetch',
    requestedForUser: { id: 'u2', username: 'bob' },
  };
  const result = buildMediaRequestSuccessMessage(mediaRequest, 'u1');
  assert.equal(result, 'Music request submitted for bob.');
});

test('buildMediaRequestSuccessMessage returns already_exists profile message for own request', () => {
  const mediaRequest = {
    requestState: 'already_exists',
    requestedForUser: { id: 'u1', username: 'alice' },
  };
  const result = buildMediaRequestSuccessMessage(mediaRequest, 'u1');
  assert.equal(result, 'This request already maps to imported media and has been added to your request profile.');
});

test('buildMediaRequestSuccessMessage returns already_exists delegated message when target differs', () => {
  const mediaRequest = {
    requestState: 'already_exists',
    requestedForUser: { id: 'u2', username: 'bob' },
  };
  const result = buildMediaRequestSuccessMessage(mediaRequest, 'u1');
  assert.equal(result, 'This request already maps to imported media and has been added for bob.');
});

test('buildMediaRequestPayload includes requestedForUserIds when admin provides multi-target selection', () => {
  const result = buildMediaRequestPayload({
    form: {
      artistName: 'Daft Punk',
      notes: '',
      releaseTitle: 'Discovery',
      requestKind: 'release',
      requestedForUserId: '',
      requestedForUserIds: ['user-1', 'user-2', 'user-3'],
      sourceUrl: '',
      trackTitle: '',
    },
    isAdmin: true,
  });
  assert.deepEqual(result.requestedForUserIds, ['user-1', 'user-2', 'user-3']);
  assert.equal(result.requestedForUserId, undefined);
});

test('buildMediaRequestPayload prefers requestedForUserIds over requestedForUserId when both present', () => {
  const result = buildMediaRequestPayload({
    form: {
      artistName: 'Daft Punk',
      notes: '',
      releaseTitle: 'Discovery',
      requestKind: 'release',
      requestedForUserId: 'user-1',
      requestedForUserIds: ['user-1', 'user-2'],
      sourceUrl: '',
      trackTitle: '',
    },
    isAdmin: true,
  });
  assert.deepEqual(result.requestedForUserIds, ['user-1', 'user-2']);
  assert.equal(result.requestedForUserId, undefined);
});

test('buildMediaRequestPayload uses requestedForUserId when no multi-target', () => {
  const result = buildMediaRequestPayload({
    form: {
      artistName: 'Daft Punk',
      notes: '',
      releaseTitle: 'Discovery',
      requestKind: 'release',
      requestedForUserId: 'user-1',
      requestedForUserIds: [],
      sourceUrl: '',
      trackTitle: '',
    },
    isAdmin: true,
  });
  assert.equal(result.requestedForUserId, 'user-1');
  assert.equal(result.requestedForUserIds, undefined);
});

test('buildMediaRequestSuccessMessage returns fanOutMessage when present', () => {
  const mediaRequest = {
    requestState: 'needs_fetch',
    requestedForUser: { id: 'u1', username: 'alice' },
    fanOutMessage: 'Request created for 3 users (2 additional targets).',
  };
  const result = buildMediaRequestSuccessMessage(mediaRequest, 'admin-1');
  assert.equal(result, 'Request created for 3 users (2 additional targets).');
});

test('getReassignmentEventLabel returns "Reassigned" for reassigned event type', () => {
  assert.equal(getReassignmentEventLabel('reassigned'), 'Reassigned');
});

test('getReassignmentEventLabel returns raw event type for unknown types', () => {
  assert.equal(getReassignmentEventLabel('something_else'), 'Something Else');
});

test('getReassignmentEventTone returns "info" for reassigned', () => {
  assert.equal(getReassignmentEventTone('reassigned'), 'info');
});

test('getReassignmentEventTone returns "info" for unknown types', () => {
  assert.equal(getReassignmentEventTone('unknown'), 'info');
});

test('formatReassignmentEventDescription builds correct description', () => {
  const event = {
    actorUsername: 'admin',
    previousRequestedForUserId: 'u-1',
    newRequestedForUserId: 'u-2',
    reason: null,
  };
  const usersById = {
    'u-1': { username: 'alice' },
    'u-2': { username: 'bob' },
  };
  const result = formatReassignmentEventDescription(event, usersById);
  assert.equal(result, 'admin reassigned from alice to bob');
});

test('formatReassignmentEventDescription includes reason when present', () => {
  const event = {
    actorUsername: 'admin',
    previousRequestedForUserId: 'u-1',
    newRequestedForUserId: 'u-2',
    reason: 'User left the team',
  };
  const usersById = {
    'u-1': { username: 'alice' },
    'u-2': { username: 'bob' },
  };
  const result = formatReassignmentEventDescription(event, usersById);
  assert.ok(result.includes('Reason: User left the team'));
});

test('formatReassignmentEventDescription handles null event', () => {
  assert.equal(formatReassignmentEventDescription(null, {}), '');
});

test('formatReassignmentEventDescription handles missing usersById entries', () => {
  const event = {
    actorUsername: null,
    previousRequestedForUserId: 'u-1',
    newRequestedForUserId: 'u-2',
    reason: null,
  };
  const result = formatReassignmentEventDescription(event, {});
  assert.ok(result.includes('An admin'));
  assert.ok(result.includes('previous requester'));
  assert.ok(result.includes('new requester'));
  assert.equal(result.includes('u-1'), false);
  assert.equal(result.includes('u-2'), false);
});

test('getRequestEventLabel returns requester-friendly labels for durable request events', () => {
  assert.equal(getRequestEventLabel('created'), 'Created');
  assert.equal(getRequestEventLabel('request_created'), 'Created');
  assert.equal(getRequestEventLabel('cancelled'), 'Cancelled');
  assert.equal(getRequestEventLabel('download_completed'), 'Download Completed');
  assert.equal(getRequestEventLabel('fulfillment_started'), 'Fulfillment Started');
  assert.equal(getRequestEventLabel('import_completed'), 'Imported');
  assert.equal(getRequestEventLabel('import_pending'), 'Import Pending');
});

test('getRequestEventTone returns danger for cancellation and success for creation', () => {
  assert.equal(getRequestEventTone('cancelled'), 'danger');
  assert.equal(getRequestEventTone('created'), 'success');
  assert.equal(getRequestEventTone('download_completed'), 'success');
  assert.equal(getRequestEventTone('fulfillment_failed'), 'danger');
  assert.equal(getRequestEventTone('import_pending'), 'info');
  assert.equal(getRequestEventTone('reassigned'), 'info');
});

test('formatRequestEventDescription formats cancelled events without admin reassignment copy', () => {
  const result = formatRequestEventDescription({
    actorUsername: 'listener',
    eventType: 'cancelled',
    reason: 'Found another source',
  }, {});
  assert.equal(result, 'listener cancelled this request. Reason: Found another source');
});

test('formatRequestEventDescription formats created events', () => {
  const result = formatRequestEventDescription({
    actorUsername: 'listener',
    eventType: 'created',
  }, {});
  assert.equal(result, 'listener created this request');
});

test('formatRequestEventDescription formats fulfillment pipeline events', () => {
  assert.equal(
    formatRequestEventDescription({ eventType: 'fulfillment_started' }, {}),
    'Fulfillment started for this request',
  );
  assert.equal(
    formatRequestEventDescription({ eventType: 'download_completed' }, {}),
    'Download completed for this request',
  );
  assert.equal(
    formatRequestEventDescription({ eventType: 'import_pending' }, {}),
    'Download complete; waiting to import files',
  );
  assert.equal(
    formatRequestEventDescription({ eventType: 'import_completed' }, {}),
    'Files were imported into the library',
  );
  assert.equal(
    formatRequestEventDescription({ eventType: 'fulfillment_failed', reason: 'No usable source' }, {}),
    'Fulfillment failed for this request. Reason: No usable source',
  );
});

test('formatRequestEventDescription avoids exposing raw user ids for requester-visible reassignment events', () => {
  const result = formatRequestEventDescription({
    actorUsername: 'admin',
    eventType: 'reassigned',
    newRequestedForUserId: 'user-new',
    previousRequestedForUserId: 'user-old',
    reason: 'Request owner corrected',
  }, {});
  assert.equal(result, 'admin reassigned from previous requester to new requester. Reason: Request owner corrected');
  assert.equal(result.includes('user-old'), false);
  assert.equal(result.includes('user-new'), false);
});

// ---------------------------------------------------------------------------
// getCancelToastMessage
// ---------------------------------------------------------------------------

test('getCancelToastMessage returns default message when no children cancelled', () => {
  assert.equal(getCancelToastMessage(0), 'Request cancelled.');
});

test('getCancelToastMessage returns default message for null', () => {
  assert.equal(getCancelToastMessage(null), 'Request cancelled.');
});

test('getCancelToastMessage returns default message for undefined', () => {
  assert.equal(getCancelToastMessage(undefined), 'Request cancelled.');
});

test('getCancelToastMessage returns singular child message for 1', () => {
  assert.equal(getCancelToastMessage(1), 'Request cancelled. 1 child request also cancelled.');
});

test('getCancelToastMessage returns plural child message for 3', () => {
  assert.equal(getCancelToastMessage(3), 'Request cancelled. 3 child requests also cancelled.');
});
