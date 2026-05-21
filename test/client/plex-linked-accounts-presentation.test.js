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
  formatPlexLinkedAccountActionLabel,
  formatPlexLinkedAccountsCountLabel,
  formatPlexOwnerLinkLabel,
  formatPlexOwnerLinkTone,
  formatPlexPreviewStateLabel,
  formatPlexPreviewStateTone,
  formatPlexRepairStateLabel,
  formatPlexRepairStateTone,
  hasPlexRepairQueue,
} from '../../src/client/lib/plex-linked-accounts-presentation.js';

test('plex-linked-accounts presentation formats owner link and preview state', () => {
  assert.equal(formatPlexOwnerLinkLabel({ linked: true }), 'Linked');
  assert.equal(formatPlexOwnerLinkTone({ linked: true }), 'success');
  assert.equal(formatPlexOwnerLinkLabel({ linked: false }), 'Not linked');
  assert.equal(formatPlexPreviewStateLabel({ state: 'ready' }), 'Preview ready');
  assert.equal(formatPlexPreviewStateTone({ state: 'error' }), 'danger');
});

test('plex-linked-accounts presentation formats repair states', () => {
  assert.equal(formatPlexRepairStateLabel('healthy'), 'Healthy');
  assert.equal(formatPlexRepairStateTone('healthy'), 'success');
  assert.equal(formatPlexRepairStateLabel('remote_profile_missing'), 'Remote profile missing');
  assert.equal(formatPlexRepairStateTone('remote_profile_missing'), 'danger');
  assert.equal(formatPlexRepairStateLabel('stale_acknowledged'), 'Stale acknowledged');
  assert.equal(formatPlexRepairStateTone('stale_acknowledged'), 'info');
});

test('plex-linked-accounts presentation exposes repair queue state', () => {
  assert.equal(formatPlexLinkedAccountsCountLabel(3, 'unlink-ready'), '3 unlink-ready');
  assert.equal(formatPlexLinkedAccountActionLabel('safe_relink'), 'Safe relink');
  assert.equal(hasPlexRepairQueue({ summary: { conflictProfiles: 0, repairRequiredUsers: 0 } }), false);
  assert.equal(hasPlexRepairQueue({ summary: { conflictProfiles: 1, repairRequiredUsers: 0 } }), true);
  assert.equal(hasPlexRepairQueue({ summary: { conflictProfiles: 0, repairRequiredUsers: 2 } }), true);
});
