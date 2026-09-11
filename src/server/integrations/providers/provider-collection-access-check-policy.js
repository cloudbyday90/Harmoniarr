/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const providerCollectionAccessCheckLimits = Object.freeze({ deadlineMs: 30000, pages: 2, requests: 8 });
export const providerAccessAuthModes = new Set(['oauth_user', 'client_credentials', 'api_key', 'developer_token', 'none']);

const outcomes = {
  access_verified: ['verified', 'Collection access verified', 'The checked pages were accessible and matched the expected provider schema. This does not prove access to other collections or music acquisition.', 'Use the traversal evidence to decide whether this sample meets release acceptance requirements.'],
  disabled: ['not_checked', 'Provider disabled', 'The selected provider is disabled. No provider request was made.', 'Enable this provider in Settings before checking access.'],
  configuration_required: ['not_checked', 'Provider configuration required', 'Usable credentials could not be resolved for the selected provider.', 'Complete the provider connection in Settings, then check the same collection again.'],
  credentials_rejected: ['failed', 'Credentials rejected', 'The provider rejected authentication. Stored credentials do not prove current access.', 'Review the provider credentials or reconnect the existing account authorization.'],
  access_denied: ['failed', 'Collection access denied', 'The provider denied this request. Account permissions, application restrictions, or quota policy may apply; the cause is not inferred from HTTP status alone.', 'Review this account’s access to the selected collection and the provider application settings.'],
  resource_unavailable: ['failed', 'Collection unavailable', 'The selected collection was not available to these credentials.', 'Check the collection link and its availability to the connected account.'],
  rate_limited: ['failed', 'Provider request rate limit reached', 'The provider reported a temporary request rate limit.', 'Wait for the reported retry interval when available before retrying.'],
  quota_exceeded: ['failed', 'Provider quota exceeded', 'The provider explicitly reported an account or application quota limit.', 'Review the provider quota and its reset policy before retrying.'],
  response_invalid: ['failed', 'Provider response could not be verified', 'The response did not match the bounded collection contract.', 'Review the provider integration and repeat this check after the response issue is resolved.'],
  source_changed: ['failed', 'Playlist changed during the check', 'The playlist version changed while its pages were being checked.', 'Repeat the check with a stable collection.'],
  timeout: ['failed', 'Provider check timed out', 'The bounded provider check reached its deadline.', 'Check provider availability and retry when the connection is responsive.'],
  unavailable: ['failed', 'Provider unavailable', 'The selected provider could not complete this check.', 'Review provider availability and retry later.'],
  request_rejected: ['failed', 'Provider request rejected', 'The provider did not accept this collection request.', 'Review the collection type and provider application settings.'],
  request_budget_exceeded: ['failed', 'Provider check request limit reached', 'The check stopped at its fixed network request budget.', 'Review the provider authentication and pagination behavior before retrying.'],
};
export const providerAccessDiagnosticCodes = Object.freeze(Object.keys(outcomes));

export function classifyProviderAccessError(error) {
  if (Object.hasOwn(outcomes, error?.diagnosticCode)) return error.diagnosticCode;
  if (error?.code === 'provider_collection_snapshot_changed') return 'source_changed';
  if (error?.collectionBlocked || error?.code === 'provider_response_invalid') return 'response_invalid';
  if (['spotify_misconfigured', 'youtube_misconfigured', 'apple_music_misconfigured', 'spotify_client_id_required', 'youtube_client_id_required', 'youtube_client_secret_required'].includes(error?.code)) return 'configuration_required';
  return 'unavailable';
}

export function presentProviderCollectionAccessCheck(state, code, error = null) {
  const [outcome, label, detail, nextAction] = outcomes[code] ?? outcomes.unavailable;
  const retry = error?.details?.retryAfterSeconds;
  return {
    schemaVersion: 1, provider: state.provider, resourceType: state.resourceType,
    authMode: providerAccessAuthModes.has(state.authMode) ? state.authMode : 'none', quotaMode: 'unknown',
    outcome, code: Object.hasOwn(outcomes, code) ? code : 'unavailable',
    pagesChecked: state.pagesChecked, entriesSeen: state.entriesSeen, hasMore: state.hasMore,
    fullTraversal: outcome === 'verified' && state.hasMore === false,
    multiPageObserved: state.pagesChecked > 1,
    snapshotCheck: state.snapshotCheck, checkedAt: state.checkedAt,
    retryAfterSeconds: Number.isSafeInteger(retry) && retry >= 0 ? Math.min(86400, retry) : null,
    label, detail, nextAction,
  };
}
