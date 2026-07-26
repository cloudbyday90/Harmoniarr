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
import { buildMusicQueueOverviewPresentation } from '../../src/client/lib/music-queue-overview-presentation.js';

const CARDS = [{
  key: 'waiting',
  label: 'Waiting',
  value: 5,
}, {
  key: 'searching',
  label: 'Searching',
  value: 0,
}, {
  key: 'downloading',
  label: 'Downloading',
  value: 2,
}, {
  key: 'ready-to-add',
  label: 'Ready to add',
  value: 1,
}, {
  key: 'needs-help',
  label: 'Needs help',
  value: 0,
}, {
  key: 'needs-setup',
  label: 'Needs setup',
  value: 0,
}];

test('Music Queue overview shows active work and leaves zero states out of the default scan path', () => {
  assert.deepEqual(buildMusicQueueOverviewPresentation(CARDS), {
    detail: '5 releases are waiting to search.',
    eyebrow: 'Automatic progress',
    facts: [{
      key: 'downloading',
      label: 'Downloading',
      tone: 'neutral',
      value: 2,
    }, {
      key: 'ready-to-add',
      label: 'Ready to add',
      tone: 'neutral',
      value: 1,
    }],
    headline: 'Harmoniarr is working on 3 releases',
    isVisible: true,
    state: 'progress',
  });
});

test('Music Queue overview prioritizes attention over routine automatic work', () => {
  const presentation = buildMusicQueueOverviewPresentation(CARDS.map((card) => (
    card.key === 'needs-help' ? { ...card, value: 1 } : card
  )));

  assert.equal(presentation.headline, '1 release needs attention');
  assert.equal(presentation.detail, 'Harmoniarr needs your help before it can continue with these releases.');
  assert.equal(presentation.eyebrow, 'Needs attention');
  assert.equal(presentation.state, 'attention');
  assert.deepEqual(presentation.facts.map((fact) => fact.key), [
    'needs-help',
    'downloading',
    'ready-to-add',
  ]);
  assert.equal(presentation.facts[0].tone, 'warning');
});

test('Music Queue overview only shows waiting work when no release is otherwise active', () => {
  const presentation = buildMusicQueueOverviewPresentation(CARDS.map((card) => ({
    ...card,
    value: card.key === 'waiting' ? 1 : 0,
  })));

  assert.deepEqual(presentation, {
    detail: 'No action is needed. Harmoniarr will search automatically when each release is due.',
    eyebrow: 'Automatic search',
    facts: [{
      key: 'waiting',
      label: 'Waiting',
      tone: 'neutral',
      value: 1,
    }],
    headline: '1 release waiting for automatic search',
    isVisible: true,
    state: 'waiting',
  });
});
