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
import { buildSettingsSetupOverview } from '../../src/client/lib/settings-setup-presentation.js';

test('settings setup keeps the download provider and media folders as the only core prerequisites', () => {
  const overview = buildSettingsSetupOverview({
    dependencies: [{
      message: 'Soulseek is connected and ready for downloads.',
      provider: 'slskd',
      status: 'healthy',
    }],
    setupProgress: {
      folders: {
        downloadsConfigured: true,
        musicConfigured: true,
        validationStatus: 'healthy',
      },
    },
  });

  assert.deepEqual(overview.coreSteps.map((step) => step.id), ['soulseek', 'folders']);
  assert.equal(overview.optionalSteps[0].id, 'library');
  assert.deepEqual(overview.readiness, {
    copy: 'Soulseek and your media folders are ready for normal download and library work.',
    label: 'Ready for downloads',
    tone: 'success',
  });
});

test('settings setup asks for media folders without exposing their saved paths', () => {
  const overview = buildSettingsSetupOverview({
    dependencies: [{ provider: 'slskd', status: 'disabled' }],
    setupProgress: {
      folders: {
        downloadsConfigured: false,
        musicConfigured: true,
        validationStatus: 'unavailable',
      },
    },
  });

  const folders = overview.coreSteps.find((step) => step.id === 'folders');
  assert.deepEqual(folders, {
    copy: 'Choose the completed-download and music-library folders Harmoniarr can use.',
    id: 'folders',
    label: 'Set folders',
    routeName: 'settings-media-storage',
    status: 'Folders needed',
    title: 'Set your folders',
    tone: 'warning',
  });
  assert.doesNotMatch(JSON.stringify(overview), /\/data\/|api.?key|base.?url|secret/i);
});

test('settings setup distinguishes a failed folder-readiness read from a missing folder', () => {
  const overview = buildSettingsSetupOverview({
    setupProgressError: 'Settings request failed',
  });

  const folders = overview.coreSteps.find((step) => step.id === 'folders');
  assert.equal(folders.status, 'Needs a check');
  assert.equal(folders.label, 'Review folders');
  assert.match(overview.readiness.copy, /2 required setup tasks remain/);
});

test('settings setup uses the focused Soulseek status result without exposing its message', () => {
  const overview = buildSettingsSetupOverview({
    connectionStatus: {
      message: 'http://private-slskd.example accepted secret-value',
      provider: 'slskd',
      status: 'healthy',
    },
    setupProgress: {
      folders: {
        downloadsConfigured: true,
        musicConfigured: true,
        validationStatus: 'healthy',
      },
      soulseek: {
        managedDeploymentMissing: false,
        providerMode: 'external',
      },
    },
  });

  const soulseek = overview.coreSteps.find((step) => step.id === 'soulseek');
  assert.equal(soulseek.status, 'Ready');
  assert.equal(soulseek.label, 'Test saved connection');
  assert.doesNotMatch(JSON.stringify(soulseek), /private-slskd|secret-value|https?:/i);
});
