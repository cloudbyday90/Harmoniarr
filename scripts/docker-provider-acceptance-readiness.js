/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const acceptedDiagnosticCodes = new Set([
  'provider_accepted',
  'provider_accepted_with_rejections',
]);

export const defaultProviderAcceptanceRequirements = Object.freeze({
  requireAcceptedTransfer: false,
  requireConfiguredProvider: true,
  requireDiagnostic: true,
  requireMusicQueueLink: false,
  requirePathMapping: true,
});

export const providerAcceptanceReadinessCodes = Object.freeze({
  acceptedTransferRequired: 'accepted_transfer_required',
  downloadDiagnosticRequired: 'download_diagnostic_required',
  musicQueueTransferRequired: 'music_queue_transfer_required',
  pathMappingRequired: 'download_path_mapping_required',
  providerConfigurationRequired: 'provider_configuration_required',
  ready: 'ready',
});

function normalizeRequirement(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function hasAcceptedTransfer(result) {
  return result?.importReview?.diagnostics?.some((diagnostic) => (
    acceptedDiagnosticCodes.has(diagnostic?.code)
  )) === true;
}

function hasDownloadDiagnostic(result) {
  return Number(result?.importReview?.diagnosticCount) > 0;
}

function createActionRequiredReadiness({ code, label, nextAction, summary }) {
  return {
    code,
    label,
    nextAction,
    ready: false,
    status: 'action_required',
    summary,
  };
}

function createReadyReadiness() {
  return {
    code: providerAcceptanceReadinessCodes.ready,
    label: 'Provider acceptance evidence is ready',
    nextAction: 'Save this result with your local validation evidence.',
    ready: true,
    status: 'ready',
    summary: 'All selected provider acceptance requirements are met.',
  };
}

/**
 * Produces the one most useful next action for a provider-acceptance probe.
 * It deliberately accepts only bounded evidence and never inspects provider
 * credentials, raw provider responses, release names, or filesystem paths.
 */
export function buildProviderAcceptanceReadiness(result, requirements = {}) {
  const expected = resolveProviderAcceptanceRequirements(requirements);
  const paths = result?.paths ?? {};
  const providerConfigured = result?.provider?.enabled === true
    && paths.slskdBaseUrlConfigured === true
    && paths.slskdSecretConfigured === true;

  if (expected.requireConfiguredProvider && !providerConfigured) {
    return createActionRequiredReadiness({
      code: providerAcceptanceReadinessCodes.providerConfigurationRequired,
      label: 'Connect the download provider',
      nextAction: 'Open Settings > Connections, complete the download provider connection, then run this check again.',
      summary: 'The Downloader connection is not fully configured.',
    });
  }

  if (expected.requirePathMapping && Number(paths.downloadMappingCount) < 1) {
    return createActionRequiredReadiness({
      code: providerAcceptanceReadinessCodes.pathMappingRequired,
      label: 'Set the download path mapping',
      nextAction: 'Open Settings > Media & storage and add the path translation shared by the download provider and Harmoniarr.',
      summary: 'No download path mapping is configured.',
    });
  }

  if (expected.requireMusicQueueLink && Number(result?.musicQueue?.linkedTransferCount) < 1) {
    return createActionRequiredReadiness({
      code: providerAcceptanceReadinessCodes.musicQueueTransferRequired,
      label: 'Continue the release in Music Queue',
      nextAction: 'Open Music Queue. Choose a match if Harmoniarr asks, then wait for the release to appear in Downloader before running this check again.',
      summary: 'No current Downloader transfer originated in Music Queue.',
    });
  }

  if (expected.requireAcceptedTransfer && !hasAcceptedTransfer(result)) {
    return createActionRequiredReadiness({
      code: providerAcceptanceReadinessCodes.acceptedTransferRequired,
      label: 'Get a provider-accepted transfer',
      nextAction: hasDownloadDiagnostic(result)
        ? 'Use the Import Review diagnostic to choose another candidate, start a download run, and sync transfer state.'
        : 'In Import Review, start a download run and sync transfer state, then run this check again.',
      summary: hasDownloadDiagnostic(result)
        ? 'The provider has not accepted a transfer yet.'
        : 'No Import Review download outcome has been recorded yet.',
    });
  }

  if (expected.requireDiagnostic && !hasDownloadDiagnostic(result)) {
    return createActionRequiredReadiness({
      code: providerAcceptanceReadinessCodes.downloadDiagnosticRequired,
      label: 'Record a download outcome',
      nextAction: 'In Import Review, start a download run and sync transfer state, then run this check again.',
      summary: 'No Import Review download outcome has been recorded yet.',
    });
  }

  return createReadyReadiness();
}

export function formatProviderAcceptanceReadinessError(readiness, {
  evidencePath = null,
} = {}) {
  if (!readiness || typeof readiness !== 'object') {
    throw new Error('provider acceptance readiness is required');
  }

  const evidenceSuffix = typeof evidencePath === 'string' && evidencePath.trim().length > 0
    ? ' A local evidence artifact was written.'
    : '';

  return `${readiness.label}: ${readiness.summary} ${readiness.nextAction}${evidenceSuffix}`;
}

export function resolveProviderAcceptanceRequirements(requirements = {}) {
  return {
    requireAcceptedTransfer: normalizeRequirement(
      requirements.requireAcceptedTransfer,
      defaultProviderAcceptanceRequirements.requireAcceptedTransfer,
    ),
    requireConfiguredProvider: normalizeRequirement(
      requirements.requireConfiguredProvider,
      defaultProviderAcceptanceRequirements.requireConfiguredProvider,
    ),
    requireDiagnostic: normalizeRequirement(
      requirements.requireDiagnostic,
      defaultProviderAcceptanceRequirements.requireDiagnostic,
    ),
    requireMusicQueueLink: normalizeRequirement(
      requirements.requireMusicQueueLink,
      defaultProviderAcceptanceRequirements.requireMusicQueueLink,
    ),
    requirePathMapping: normalizeRequirement(
      requirements.requirePathMapping,
      defaultProviderAcceptanceRequirements.requirePathMapping,
    ),
  };
}
