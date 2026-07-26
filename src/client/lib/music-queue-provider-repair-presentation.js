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

const providerDependentStatusCodes = new Set([
  'checking_matches',
  'downloading',
  'pick_match',
  'queued_for_search',
  'searching',
  'trying_next_match',
]);

function findSoulseekHealth(dependencies) {
  return Array.isArray(dependencies)
    ? dependencies.find((dependency) => dependency?.provider === 'slskd') ?? null
    : null;
}

function buildNotice({ code, copy, label, title }) {
  return {
    actionRouteName: 'settings-connections',
    code,
    copy,
    label,
    title,
    tone: 'warning',
  };
}

export function hasMusicQueueProviderDependentWork(releases) {
  return Array.isArray(releases)
    && releases.some((release) => providerDependentStatusCodes.has(release?.statusCode));
}

/**
 * Returns a concise, safe provider repair notice. Health messages and codes are
 * intentionally not forwarded because they can include deployment details.
 */
export function buildMusicQueueProviderRepairNotice({
  dependencies,
  setupProgress,
} = {}) {
  const providerMode = setupProgress?.soulseek?.providerMode;
  if (providerMode === 'disabled') {
    return buildNotice({
      code: 'downloads_off',
      copy: 'Turn on a Soulseek provider before queued music can continue.',
      label: 'Choose provider mode',
      title: 'Downloads are off',
    });
  }

  if (setupProgress?.soulseek?.managedDeploymentMissing) {
    return buildNotice({
      code: 'managed_setup_required',
      copy: 'Finish the managed setup before queued music can continue.',
      label: 'Finish managed setup',
      title: 'Managed setup required',
    });
  }

  const health = findSoulseekHealth(dependencies);
  if (!health || health.status === 'healthy') return null;

  if (health.status === 'disabled') {
    return buildNotice({
      code: 'external_setup_required',
      copy: 'Connect Soulseek before queued music can continue.',
      label: 'Set up Soulseek',
      title: 'Soulseek needs setup',
    });
  }

  return buildNotice({
    code: 'provider_attention_required',
    copy: 'Queued music will continue when Harmoniarr can reach Soulseek.',
    label: 'Check Soulseek connection',
    title: 'Soulseek needs attention',
  });
}
