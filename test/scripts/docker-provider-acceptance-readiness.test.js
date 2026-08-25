import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProviderAcceptanceReadiness,
  formatProviderAcceptanceReadinessError,
  providerAcceptanceReadinessCodes,
} from '../../scripts/docker-provider-acceptance-readiness.js';

function createEvidence({
  acceptedTransfer = true,
  diagnosticCount = 1,
  linkedTransferCount = 1,
  mappingCount = 1,
  providerConfigured = true,
} = {}) {
  return {
    importReview: {
      diagnosticCount,
      diagnostics: acceptedTransfer ? [{ code: 'provider_accepted' }] : [{ code: 'provider_rejected_all_files' }],
    },
    musicQueue: {
      linkedTransferCount,
    },
    paths: {
      downloadMappingCount: mappingCount,
      slskdBaseUrlConfigured: providerConfigured,
      slskdSecretConfigured: providerConfigured,
    },
    provider: {
      enabled: providerConfigured,
    },
  };
}

test('provider acceptance readiness reports the first required action in setup order', () => {
  const providerReadiness = buildProviderAcceptanceReadiness(createEvidence({
    mappingCount: 0,
    providerConfigured: false,
  }));
  assert.deepEqual(providerReadiness, {
    code: providerAcceptanceReadinessCodes.providerConfigurationRequired,
    label: 'Connect the download provider',
    nextAction: 'Open Settings > Connections, complete the download provider connection, then run this check again.',
    ready: false,
    status: 'action_required',
    summary: 'The Downloader connection is not fully configured.',
  });

  const mappingReadiness = buildProviderAcceptanceReadiness(createEvidence({ mappingCount: 0 }));
  assert.equal(mappingReadiness.code, providerAcceptanceReadinessCodes.pathMappingRequired);
  assert.equal(mappingReadiness.label, 'Set the download path mapping');
});

test('provider acceptance readiness distinguishes a missing outcome from a rejected transfer', () => {
  const missingOutcome = buildProviderAcceptanceReadiness(createEvidence({
    acceptedTransfer: false,
    diagnosticCount: 0,
  }), {
    requireAcceptedTransfer: true,
  });
  assert.equal(missingOutcome.code, providerAcceptanceReadinessCodes.acceptedTransferRequired);
  assert.equal(missingOutcome.label, 'Get a provider-accepted transfer');
  assert.match(missingOutcome.nextAction, /start a download run/u);

  const rejectedTransfer = buildProviderAcceptanceReadiness(createEvidence({ acceptedTransfer: false }), {
    requireAcceptedTransfer: true,
  });
  assert.equal(rejectedTransfer.code, providerAcceptanceReadinessCodes.acceptedTransferRequired);
  assert.match(rejectedTransfer.nextAction, /choose another candidate/u);
});

test('provider acceptance readiness identifies the Music Queue handoff separately', () => {
  const readiness = buildProviderAcceptanceReadiness(createEvidence({ linkedTransferCount: 0 }), {
    requireAcceptedTransfer: true,
    requireMusicQueueLink: true,
  });

  assert.equal(readiness.code, providerAcceptanceReadinessCodes.musicQueueTransferRequired);
  assert.equal(readiness.label, 'Start a Music Queue download');
  assert.equal(readiness.ready, false);
});

test('provider acceptance readiness reports ready only when every selected requirement is met', () => {
  const readiness = buildProviderAcceptanceReadiness(createEvidence(), {
    requireAcceptedTransfer: true,
    requireMusicQueueLink: true,
  });

  assert.deepEqual(readiness, {
    code: providerAcceptanceReadinessCodes.ready,
    label: 'Provider acceptance evidence is ready',
    nextAction: 'Save this result with your local validation evidence.',
    ready: true,
    status: 'ready',
    summary: 'All selected provider acceptance requirements are met.',
  });
});

test('provider acceptance readiness errors are bounded without exposing the evidence path', () => {
  const readiness = buildProviderAcceptanceReadiness(createEvidence({
    mappingCount: 0,
  }));
  const message = formatProviderAcceptanceReadinessError(readiness, {
    evidencePath: 'C:/repo/.tmp/provider-acceptance.json',
  });

  assert.match(message, /^Set the download path mapping:/u);
  assert.match(message, /A local evidence artifact was written\./u);
  assert.doesNotMatch(message, /apiKey|\/downloads\/complete|slskd:5030|C:\/repo/u);
});
