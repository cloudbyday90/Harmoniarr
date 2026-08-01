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
  SETTINGS_RECOVERY_CONTEXT,
  SETTINGS_RECOVERY_QUERY_KEY,
  SETTINGS_RECOVERY_RELEASE_QUERY_KEY,
  buildSettingsFolderRecoveryConfirmation,
  buildSettingsRecoveryHandoffLocation,
  buildSettingsRecoveryReturnAction,
  createSettingsRecoveryContext,
  resolveSettingsRecoveryContext,
} from '../../src/client/lib/settings-recovery-handoff.js';
import { buildSettingsMusicQueueSafeAddRecheckConfirmation } from '../../src/client/lib/settings-music-queue-safe-add-recheck-presentation.js';

test('Settings recovery contexts accept only fixed internal destinations', () => {
  assert.deepEqual(
    resolveSettingsRecoveryContext({ [SETTINGS_RECOVERY_QUERY_KEY]: SETTINGS_RECOVERY_CONTEXT.DOWNLOADER }),
    { context: SETTINGS_RECOVERY_CONTEXT.DOWNLOADER },
  );
  assert.equal(resolveSettingsRecoveryContext({ [SETTINGS_RECOVERY_QUERY_KEY]: '/app/downloader' }), null);
  assert.equal(resolveSettingsRecoveryContext({ [SETTINGS_RECOVERY_QUERY_KEY]: 'https://outside.example' }), null);
  assert.equal(resolveSettingsRecoveryContext({ [SETTINGS_RECOVERY_QUERY_KEY]: SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE }), null);
  assert.equal(
    createSettingsRecoveryContext({
      context: SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE,
      wantedReleaseId: '../../outside',
    }),
    null,
  );
});

test('Settings recovery serializes a bounded release context and restores only its named route', () => {
  const recoveryContext = createSettingsRecoveryContext({
    context: SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE,
    wantedReleaseId: 'wanted-release-1',
  });

  assert.deepEqual(
    buildSettingsRecoveryHandoffLocation({
      recoveryContext,
      routeName: 'settings-media-storage',
    }),
    {
      name: 'settings-media-storage',
      query: {
        [SETTINGS_RECOVERY_QUERY_KEY]: SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE,
        [SETTINGS_RECOVERY_RELEASE_QUERY_KEY]: 'wanted-release-1',
      },
    },
  );
  assert.deepEqual(
    buildSettingsRecoveryReturnAction({ recoveryContext }),
    {
      label: 'Return to Music Queue',
      params: { wantedReleaseId: 'wanted-release-1' },
      routeName: 'music-queue-release',
    },
  );
});

test('Settings folder recovery returns only after server folder validation is healthy', () => {
  const recoveryContext = createSettingsRecoveryContext({
    context: SETTINGS_RECOVERY_CONTEXT.ACTIVITY_LIBRARY_ADD_RELEASE,
    wantedReleaseId: 'wanted-release-1',
  });
  const ready = buildSettingsFolderRecoveryConfirmation({
    recoveryContext,
    validation: { summary: { status: 'healthy' } },
  });
  const unresolved = buildSettingsFolderRecoveryConfirmation({
    recoveryContext,
    validation: {
      roots: [{ path: '/private/downloads', status: 'unavailable' }],
      summary: { message: 'private mount failure', status: 'unavailable' },
    },
  });

  assert.deepEqual(ready.action, {
    label: 'Return to Activity',
    query: { wantedReleaseId: 'wanted-release-1' },
    routeName: 'activity-diagnostics-library-adds',
  });
  assert.equal(ready.outcome, 'ready');
  assert.equal(unresolved.action, null);
  assert.equal(unresolved.outcome, 'needs_attention');
  assert.doesNotMatch(JSON.stringify(unresolved), /private|mount failure/i);
});

test('Settings recheck feedback exposes only the scoped Music Queue release outcome', () => {
  const recoveryContext = createSettingsRecoveryContext({
    context: SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE,
    wantedReleaseId: 'wanted-release-1',
  });
  const queued = buildSettingsMusicQueueSafeAddRecheckConfirmation({
    recoveryContext,
    recheck: { action: { outcome: 'queued', runId: 'apply-run-1' } },
  });
  const blocked = buildSettingsMusicQueueSafeAddRecheckConfirmation({
    recoveryContext,
    recheck: { action: { outcome: 'still_needs_review', internalPath: '/private/downloads' } },
  });

  assert.equal(queued.title, 'Library add resumed');
  assert.deepEqual(queued.action, {
    label: 'Return to Music Queue',
    params: { wantedReleaseId: 'wanted-release-1' },
    routeName: 'music-queue-release',
  });
  assert.equal(blocked.title, 'Library add still needs review');
  assert.doesNotMatch(JSON.stringify(blocked), /private|downloads|apply-run/i);
});
