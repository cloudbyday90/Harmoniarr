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
import { test } from 'node:test';

import {
  JOURNEY_STAGE,
  STAGE_STATUS,
  buildRequestJourney,
  journeyStatusLabel,
  journeyStatusTone,
  resolveCurrentStageKey,
} from '../../src/client/lib/request-journey.js';

function stageByKey(journey, key) {
  return journey.stages.find((stage) => stage.key === key);
}

function statusOf(journey, key) {
  return stageByKey(journey, key)?.status;
}

test('returns an empty journey when there is no media request', () => {
  const journey = buildRequestJourney({ mediaRequest: null, candidates: [] });
  assert.deepEqual(journey.stages, []);
  assert.equal(journey.currentStageKey, null);
});

test('always includes the five canonical stages in order', () => {
  const journey = buildRequestJourney({ mediaRequest: { requestState: 'needs_fetch' }, candidates: [] });
  assert.deepEqual(
    journey.stages.map((stage) => stage.key),
    [
      JOURNEY_STAGE.REQUESTED,
      JOURNEY_STAGE.SEARCHING,
      JOURNEY_STAGE.DOWNLOADING,
      JOURNEY_STAGE.IMPORTING,
      JOURNEY_STAGE.LIBRARY,
    ],
  );
});

test('a freshly submitted request is searching with no candidates', () => {
  const journey = buildRequestJourney({ mediaRequest: { requestState: 'needs_fetch' }, candidates: [] });
  assert.equal(statusOf(journey, JOURNEY_STAGE.REQUESTED), STAGE_STATUS.COMPLETE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.SEARCHING), STAGE_STATUS.ACTIVE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.DOWNLOADING), STAGE_STATUS.PENDING);
  assert.equal(journey.currentStageKey, JOURNEY_STAGE.SEARCHING);
});

test('a downloading candidate marks searching complete and downloading active', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'needs_review' },
    candidates: [{ id: 'c1', status: 'downloading' }],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.SEARCHING), STAGE_STATUS.COMPLETE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.DOWNLOADING), STAGE_STATUS.ACTIVE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.IMPORTING), STAGE_STATUS.PENDING);
  assert.equal(journey.currentStageKey, JOURNEY_STAGE.DOWNLOADING);
});

test('an import_pending candidate completes downloading and waits on importing', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'needs_review' },
    candidates: [{ id: 'c1', status: 'import_pending' }],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.DOWNLOADING), STAGE_STATUS.COMPLETE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.IMPORTING), STAGE_STATUS.PENDING);
  assert.equal(statusOf(journey, JOURNEY_STAGE.LIBRARY), STAGE_STATUS.PENDING);
});

test('a running apply run marks importing active', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'needs_review' },
    candidates: [{ id: 'c1', status: 'import_pending', apply: { runStatus: 'running' } }],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.DOWNLOADING), STAGE_STATUS.COMPLETE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.IMPORTING), STAGE_STATUS.ACTIVE);
  assert.equal(journey.currentStageKey, JOURNEY_STAGE.IMPORTING);
});

test('an applied candidate completes the whole journey', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'needs_review' },
    candidates: [{ id: 'c1', status: 'applied' }],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.DOWNLOADING), STAGE_STATUS.COMPLETE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.IMPORTING), STAGE_STATUS.COMPLETE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.LIBRARY), STAGE_STATUS.COMPLETE);
  assert.equal(journey.currentStageKey, JOURNEY_STAGE.LIBRARY);
});

test('already_exists short-circuits to in-library and skips middle stages', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'already_exists' },
    candidates: [],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.SEARCHING), STAGE_STATUS.COMPLETE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.DOWNLOADING), STAGE_STATUS.SKIPPED);
  assert.equal(statusOf(journey, JOURNEY_STAGE.IMPORTING), STAGE_STATUS.SKIPPED);
  assert.equal(statusOf(journey, JOURNEY_STAGE.LIBRARY), STAGE_STATUS.COMPLETE);
  assert.equal(journey.isTerminal, true);
});

test('a failed search with no candidates marks searching failed', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'failed' },
    candidates: [],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.SEARCHING), STAGE_STATUS.FAILED);
  assert.equal(journey.currentStageKey, JOURNEY_STAGE.SEARCHING);
  assert.equal(journey.isTerminal, true);
});

test('a failed download surfaces on the downloading stage', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'needs_review' },
    candidates: [{ id: 'c1', status: 'selected', execution: { runStatus: 'failed' } }],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.DOWNLOADING), STAGE_STATUS.FAILED);
  assert.equal(journey.currentStageKey, JOURNEY_STAGE.DOWNLOADING);
});

test('a cancelled request before any candidate marks downstream stages cancelled', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'cancelled' },
    candidates: [],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.REQUESTED), STAGE_STATUS.COMPLETE);
  assert.equal(statusOf(journey, JOURNEY_STAGE.SEARCHING), STAGE_STATUS.CANCELLED);
  assert.equal(journey.currentStageKey, JOURNEY_STAGE.SEARCHING);
});

test('aggregates the most-progressed candidate across multiple candidates', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'needs_review' },
    candidates: [
      { id: 'c1', status: 'rejected' },
      { id: 'c2', status: 'applied' },
    ],
  });
  assert.equal(statusOf(journey, JOURNEY_STAGE.LIBRARY), STAGE_STATUS.COMPLETE);
});

test('exactly one stage is ever the current stage', () => {
  const journey = buildRequestJourney({
    mediaRequest: { requestState: 'needs_review' },
    candidates: [{ id: 'c1', status: 'downloading' }],
  });
  const currentMatches = journey.stages.filter((stage) => stage.key === journey.currentStageKey);
  assert.equal(currentMatches.length, 1);
});

test('resolveCurrentStageKey prefers an active stage over completed stages', () => {
  const key = resolveCurrentStageKey([
    { key: 'a', status: STAGE_STATUS.COMPLETE },
    { key: 'b', status: STAGE_STATUS.ACTIVE },
    { key: 'c', status: STAGE_STATUS.PENDING },
  ]);
  assert.equal(key, 'b');
});

test('resolveCurrentStageKey falls back to the last completed stage', () => {
  const key = resolveCurrentStageKey([
    { key: 'a', status: STAGE_STATUS.COMPLETE },
    { key: 'b', status: STAGE_STATUS.COMPLETE },
    { key: 'c', status: STAGE_STATUS.PENDING },
  ]);
  assert.equal(key, 'b');
});

test('status label and tone helpers cover every status', () => {
  for (const status of Object.values(STAGE_STATUS)) {
    assert.equal(typeof journeyStatusLabel(status), 'string');
    assert.ok(journeyStatusLabel(status).length > 0);
    assert.ok(['success', 'warning', 'info', 'danger', 'muted'].includes(journeyStatusTone(status)));
  }
});
