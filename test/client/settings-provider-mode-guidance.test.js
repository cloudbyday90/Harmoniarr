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
  buildSlskdProviderModeGuidance,
  managedSlskdComposeCommand,
  managedSlskdSecretFiles,
} from '../../src/client/lib/settings-provider-mode-guidance.js';

test('managed mode without its deployment gives a concise safe setup checklist', () => {
  assert.deepEqual(buildSlskdProviderModeGuidance({ providerMode: 'managed' }), {
    command: managedSlskdComposeCommand,
    copy: 'Managed mode needs the Harmoniarr Docker overlay. Create its secret files, start the overlay, then save and test this connection.',
    secretFiles: managedSlskdSecretFiles,
    title: 'Finish managed setup',
    type: 'managed_setup',
  });
});

test('managed mode hides setup guidance once the deployment marker is present', () => {
  assert.equal(buildSlskdProviderModeGuidance({
    managedDeploymentDetected: true,
    providerMode: 'managed',
  }), null);
});

test('external mode links to the existing folders and path-translations surface', () => {
  assert.deepEqual(buildSlskdProviderModeGuidance({ providerMode: 'external' }), {
    actionLabel: 'Set up folders',
    actionRouteName: 'settings-media-storage',
    copy: 'Harmoniarr must be able to read the completed-download folder used by your external service. Add a path translation only when the two containers use different folder paths.',
    title: 'Make completed downloads available',
    type: 'external_folders',
  });
});

test('disabled mode adds no deployment or folders noise', () => {
  assert.equal(buildSlskdProviderModeGuidance({ providerMode: 'disabled' }), null);
});
