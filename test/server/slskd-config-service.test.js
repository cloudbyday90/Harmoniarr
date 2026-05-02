import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdConfigService } from '../../src/server/slskd/slskd-config-service.js';

function createBaseSettings() {
  return {
    slskd: {
      baseUrl: 'http://slskd.internal:5030',
      requestTimeoutMs: 15000,
    },
  };
}

test('createSlskdConfigService reports stored secrets ahead of environment fallback', async () => {
  const service = createSlskdConfigService({
    env: { SLSKD_API_KEY: 'env-api-key' },
    encryptedSecretService: {
      getSecretMetadata: async () => ({ configured: true, updatedAt: '2026-05-01T12:00:00.000Z' }),
      getSecretValue: async () => 'stored-api-key',
    },
    loadSettingsFn: async () => createBaseSettings(),
  });

  assert.deepEqual(await service.buildSecretStatus(), {
    apiKeyConfigured: true,
    apiKeySource: 'stored',
    apiKeyUpdatedAt: '2026-05-01T12:00:00.000Z',
  });
});

test('createSlskdConfigService builds runtime config from stored secrets and persisted settings', async () => {
  const service = createSlskdConfigService({
    env: { SLSKD_API_KEY: 'env-api-key', SLSKD_BASE_URL: 'http://env-slskd:5030', SLSKD_REQUEST_TIMEOUT_MS: '20000' },
    encryptedSecretService: {
      getSecretMetadata: async () => ({ configured: true, updatedAt: null }),
      getSecretValue: async () => 'stored-api-key',
    },
    loadSettingsFn: async () => createBaseSettings(),
  });

  assert.deepEqual(await service.buildRuntimeConfig(), {
    apiKey: 'stored-api-key',
    baseUrl: 'http://slskd.internal:5030',
    requestTimeoutMs: 15000,
  });
});

test('createSlskdConfigService strips secret fields from the general settings patch and writes them separately', async (t) => {
  const encryptedSecretService = {
    clearSecretValue: t.mock.fn(async () => {}),
    getSecretMetadata: async () => ({ configured: false, updatedAt: null }),
    getSecretValue: async () => null,
    setSecretValue: t.mock.fn(async () => {}),
  };
  const service = createSlskdConfigService({
    encryptedSecretService,
    loadSettingsFn: async () => createBaseSettings(),
  });
  const mutation = service.buildSecretMutation({
    slskd: {
      apiKey: '  next-api-key  ',
      baseUrl: 'http://slskd.next:5030',
      clearApiKey: false,
    },
  });

  assert.deepEqual(mutation.sanitizedPatch, {
    slskd: {
      baseUrl: 'http://slskd.next:5030',
    },
  });
  assert.deepEqual(mutation.updatedKeys, ['slskd.apiKey']);

  await mutation.apply({ query: async () => ({ rows: [] }) });

  assert.equal(encryptedSecretService.setSecretValue.mock.callCount(), 1);
  assert.equal(encryptedSecretService.clearSecretValue.mock.callCount(), 0);
  assert.equal(encryptedSecretService.setSecretValue.mock.calls[0].arguments[0].plaintextValue, 'next-api-key');
});

test('createSlskdConfigService clears stored secrets when requested explicitly', async (t) => {
  const encryptedSecretService = {
    clearSecretValue: t.mock.fn(async () => {}),
    getSecretMetadata: async () => ({ configured: false, updatedAt: null }),
    getSecretValue: async () => null,
    setSecretValue: t.mock.fn(async () => {}),
  };
  const service = createSlskdConfigService({
    encryptedSecretService,
    loadSettingsFn: async () => createBaseSettings(),
  });
  const mutation = service.buildSecretMutation({
    slskd: {
      clearApiKey: true,
    },
  });

  await mutation.apply({ query: async () => ({ rows: [] }) });

  assert.equal(encryptedSecretService.clearSecretValue.mock.callCount(), 1);
  assert.equal(encryptedSecretService.setSecretValue.mock.callCount(), 0);
});