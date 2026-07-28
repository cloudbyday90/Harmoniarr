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
import { buildMusicQueueStatusPresentation } from '../../src/client/lib/music-queue-status-presentation.js';

const CARDS = [{
  key: 'waiting',
  value: 5,
}, {
  key: 'searching',
  value: 0,
}, {
  key: 'downloading',
  value: 2,
}, {
  key: 'ready-to-add',
  value: 1,
}, {
  key: 'needs-help',
  value: 0,
}, {
  key: 'needs-setup',
  value: 0,
}];

test('Music Queue status prioritizes active work while keeping scheduled search secondary', () => {
  assert.deepEqual(buildMusicQueueStatusPresentation(CARDS), {
    primaryDetail: 'Downloads, checks, and library adds continue automatically.',
    primaryHeadline: 'Harmoniarr is working on 3 releases',
    scheduledSearchCount: 5,
    scheduledSearchDetail: '5 releases are scheduled for automatic search.',
    state: 'progress',
  });
});

test('Music Queue status prioritizes attention over routine work', () => {
  assert.deepEqual(buildMusicQueueStatusPresentation(CARDS.map((card) => (
    card.key === 'needs-help' ? { ...card, value: 1 } : card
  ))), {
    primaryDetail: 'Harmoniarr is also working on 3 releases.',
    primaryHeadline: '1 release needs attention',
    scheduledSearchCount: 5,
    scheduledSearchDetail: '5 releases are scheduled for automatic search.',
    state: 'attention',
  });
});

test('Music Queue status describes scheduled work without treating it as a current task', () => {
  assert.deepEqual(buildMusicQueueStatusPresentation(CARDS.map((card) => ({
    ...card,
    value: card.key === 'waiting' ? 1 : 0,
  }))), {
    primaryDetail: 'No action is needed. Harmoniarr will search automatically when each release is due.',
    primaryHeadline: 'No releases are moving or need help right now.',
    scheduledSearchCount: 1,
    scheduledSearchDetail: '1 release is scheduled for automatic search.',
    state: 'scheduled',
  });
});
