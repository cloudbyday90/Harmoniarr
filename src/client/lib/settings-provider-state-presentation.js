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

const providerModes = new Set(['disabled', 'external', 'managed']);

function normalizeProviderMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return providerModes.has(normalized) ? normalized : 'external';
}

function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildState({
  actionLabel,
  canTest = false,
  message,
  mode,
  state,
  statusLabel,
  tone,
}) {
  return {
    actionLabel,
    canTest,
    message,
    mode,
    state,
    statusLabel,
    tone,
  };
}

function buildDownloadsOffState(mode) {
  return buildState({
    actionLabel: 'Choose a download mode',
    message: 'Harmoniarr will not contact Soulseek or start downloads until you choose Managed or External and save the change.',
    mode,
    state: 'downloads_off',
    statusLabel: 'Downloads off',
    tone: 'info',
  });
}

function buildManagedSetupState(mode) {
  return buildState({
    actionLabel: 'Finish managed setup',
    message: 'The managed Soulseek deployment is not available yet. Finish its Docker setup, then save and test the connection.',
    mode,
    state: 'managed_setup_required',
    statusLabel: 'Setup needed',
    tone: 'warning',
  });
}

function buildConnectionSetupState(mode) {
  return buildState({
    actionLabel: 'Review connection details',
    message: 'The saved Soulseek address or API key needs attention before downloads can start.',
    mode,
    state: 'connection_setup_required',
    statusLabel: 'Setup needed',
    tone: 'warning',
  });
}

function buildConnectionUnavailableState(mode) {
  return buildState({
    actionLabel: 'Try connection again',
    canTest: true,
    message: 'Harmoniarr could not reach Soulseek. Check that the service is running and reachable, then try again.',
    mode,
    state: 'connection_unavailable',
    statusLabel: 'Unavailable',
    tone: 'danger',
  });
}

function buildConnectionNotReadyState(mode) {
  return buildState({
    actionLabel: 'Try connection again',
    canTest: true,
    message: 'Soulseek is connected but not ready for downloads yet. Wait briefly, then try again.',
    mode,
    state: 'connection_not_ready',
    statusLabel: 'Not ready',
    tone: 'warning',
  });
}

function buildHealthyConnectionState(mode) {
  return buildState({
    actionLabel: 'Test saved connection',
    canTest: true,
    message: 'Soulseek is connected and ready for searches and downloads.',
    mode,
    state: 'connection_healthy',
    statusLabel: 'Ready',
    tone: 'success',
  });
}

function buildNotCheckedState(mode) {
  return buildState({
    actionLabel: 'Test saved connection',
    canTest: true,
    message: 'Test the saved Soulseek connection before relying on automatic downloads.',
    mode,
    state: 'connection_not_checked',
    statusLabel: 'Not checked',
    tone: 'info',
  });
}

/**
 * Maps the saved provider mode and the narrowly scoped connection result to
 * one home-user-facing status and one safe next action. Provider response
 * messages are deliberately never rendered here because transport errors can
 * disclose addresses, credentials, or implementation details.
 *
 * @param {{ connectionErrorCode?: string|null, connectionStatus?: { code?: string, status?: string }|null, managedDeploymentDetected?: boolean, providerMode?: string|null, providerModeState?: string|null }} input
 * @returns {{ actionLabel: string, canTest: boolean, message: string, mode: string, state: string, statusLabel: string, tone: string }}
 */
export function buildSettingsSoulseekProviderState({
  connectionErrorCode = null,
  connectionStatus = null,
  managedDeploymentDetected = false,
  providerMode = 'external',
  providerModeState = null,
} = {}) {
  const mode = normalizeProviderMode(providerMode);
  const errorCode = normalizeCode(connectionErrorCode);
  const statusCode = normalizeCode(connectionStatus?.code);
  const status = normalizeStatus(connectionStatus?.status);

  if (mode === 'disabled' || errorCode === 'slskd_disabled' || status === 'disabled') {
    return buildDownloadsOffState(mode);
  }

  if (
    providerModeState === 'managed_deployment_missing'
    || errorCode === 'slskd_managed_deployment_missing'
    || statusCode === 'slskd_managed_deployment_missing'
    || (mode === 'managed' && !managedDeploymentDetected)
  ) {
    return buildManagedSetupState(mode);
  }

  if (
    errorCode === 'slskd_misconfigured'
    || errorCode === 'slskd_unauthorized'
    || status === 'misconfigured'
    || statusCode === 'slskd_misconfigured'
    || statusCode === 'slskd_unauthorized'
  ) {
    return buildConnectionSetupState(mode);
  }

  if (
    errorCode
    || status === 'unavailable'
    || statusCode === 'slskd_unavailable'
  ) {
    return buildConnectionUnavailableState(mode);
  }

  if (status === 'degraded') {
    return buildConnectionNotReadyState(mode);
  }

  if (status === 'healthy') {
    return buildHealthyConnectionState(mode);
  }

  return buildNotCheckedState(mode);
}
