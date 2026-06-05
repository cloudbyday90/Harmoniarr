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
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const TIMELINE = new URL('../../src/client/components/RequestJourneyTimeline.vue', import.meta.url);
const PROGRESS_BAR = new URL('../../src/client/components/RequestStageProgressBar.vue', import.meta.url);
const REQUEST_DETAIL = new URL('../../src/client/views/RequestDetailView.vue', import.meta.url);

async function read(url) {
  return readFile(url, 'utf8');
}

test('RequestJourneyTimeline uses a semantic ordered list for the step sequence', async () => {
  const source = await read(TIMELINE);
  assert.match(source, /<ol\b/);
  assert.match(source, /<li\b/);
  assert.match(source, /v-for="stage in stages"/);
});

test('RequestJourneyTimeline marks only the current step with aria-current="step"', async () => {
  const source = await read(TIMELINE);
  // APG breadcrumb pattern: exactly one element carries aria-current.
  assert.match(source, /:aria-current="stage\.key === currentStageKey \? 'step' : undefined"/);
});

test('RequestJourneyTimeline announces status changes through a polite live region', async () => {
  const source = await read(TIMELINE);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="status"/);
});

test('RequestJourneyTimeline derives tone and label from the pure journey lib', async () => {
  const source = await read(TIMELINE);
  assert.match(source, /from '\.\.\/lib\/request-journey\.js'/);
  assert.match(source, /journeyStatusLabel/);
  assert.match(source, /journeyStatusTone/);
});

test('RequestJourneyTimeline renders stage progress when the journey model provides it', async () => {
  const source = await read(TIMELINE);
  assert.match(source, /import RequestStageProgressBar from '\.\/RequestStageProgressBar\.vue'/);
  assert.match(source, /v-if="stage\.progress"/);
  assert.match(source, /:progress="stage\.progress"/);
});

test('RequestStageProgressBar follows APG progressbar value semantics', async () => {
  const source = await read(PROGRESS_BAR);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /aria-valuemin="0"/);
  assert.match(source, /aria-valuemax="100"/);
  assert.match(source, /:aria-valuenow="isDeterminate \? percentComplete : undefined"/);
  assert.match(source, /:aria-valuetext="valueText"/);
  assert.match(source, /:aria-describedby="descriptionId"/);
  assert.match(source, /:data-freshness="freshness"/);
});

test('RequestStageProgressBar keeps progress text outside the progressbar element', async () => {
  const source = await read(PROGRESS_BAR);
  assert.match(source, /class="rsp-track"[\s\S]*role="progressbar"[\s\S]*>\s*<span class="rsp-fill"/);
  assert.match(source, /<span :id="descriptionId" class="rsp-text">/);
});

test('RequestStageProgressBar renders observed time with machine-readable datetime', async () => {
  const source = await read(PROGRESS_BAR);
  assert.match(source, /<time[\s\S]*v-if="observedAtLabel"[\s\S]*:datetime="progress\.observedAt"/);
  assert.match(source, /class="rsp-freshness"/);
});

test('RequestDetailView mounts the journey timeline from existing read models', async () => {
  const source = await read(REQUEST_DETAIL);
  assert.match(source, /import RequestJourneyTimeline from '\.\.\/components\/RequestJourneyTimeline\.vue'/);
  assert.match(source, /buildRequestJourney\(\{ mediaRequest: mediaRequest\.value, candidates: pipelineCandidates\.value \}\)/);
  assert.match(source, /<RequestJourneyTimeline[\s\S]*:stages="journey\.stages"[\s\S]*:current-stage-key="journey\.currentStageKey"/);
});
