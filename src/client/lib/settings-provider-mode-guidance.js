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

export const managedSlskdComposeCommand = 'docker compose -f compose.yaml -f compose.slskd-example.yaml up -d --build';

export const managedSlskdSecretFiles = Object.freeze([
  'slskd_api_key',
  'slskd_soulseek_username',
  'slskd_soulseek_password',
  'slskd_web_username',
  'slskd_web_password',
  'slskd_jwt_key',
]);

export function buildSlskdProviderModeGuidance({
  managedDeploymentDetected = false,
  providerMode = 'external',
} = {}) {
  if (providerMode === 'managed' && !managedDeploymentDetected) {
    return {
      command: managedSlskdComposeCommand,
      copy: 'Managed mode needs the Harmoniarr Docker overlay. Create its secret files, start the overlay, then save and test this connection.',
      secretFiles: managedSlskdSecretFiles,
      title: 'Finish managed setup',
      type: 'managed_setup',
    };
  }

  if (providerMode === 'external') {
    return {
      actionLabel: 'Set up folders',
      actionRouteName: 'settings-media-storage',
      copy: 'Harmoniarr must be able to read the completed-download folder used by your external service. Add a path translation only when the two containers use different folder paths.',
      title: 'Make completed downloads available',
      type: 'external_folders',
    };
  }

  return null;
}
