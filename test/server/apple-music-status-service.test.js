import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppleMusicStatusService } from '../../src/server/integrations/apple-music/apple-music-status-service.js';

test('buildStatus returns configured false when credentials are missing', async () => {
  const service = createAppleMusicStatusService({
    loadSettingsFn: async () => ({
      providers: {
        appleMusicKeyId: '',
        appleMusicStorefront: 'us',
        appleMusicTeamId: '',
      },
    }),
    providerCredentialsService: {
      resolveAppleMusicPrivateKey: async () => null,
    },
  });

  const status = await service.buildStatus({});

  assert.equal(status.configured, false);
  assert.equal(status.provider, 'apple_music');
  assert.equal(status.storefront, 'us');
  assert.equal(status.teamIdConfigured, false);
  assert.equal(status.keyIdConfigured, false);
  assert.equal(status.privateKeyConfigured, false);
});

test('buildStatus returns configured true when all credentials are present', async () => {
  const service = createAppleMusicStatusService({
    loadSettingsFn: async () => ({
      providers: {
        appleMusicKeyId: 'ABC1234DEF',
        appleMusicStorefront: 'gb',
        appleMusicTeamId: 'TEAM1234',
      },
    }),
    providerCredentialsService: {
      resolveAppleMusicPrivateKey: async () => '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
    },
  });

  const status = await service.buildStatus({});

  assert.equal(status.configured, true);
  assert.equal(status.provider, 'apple_music');
  assert.equal(status.storefront, 'gb');
  assert.equal(status.teamIdConfigured, true);
  assert.equal(status.keyIdConfigured, true);
  assert.equal(status.privateKeyConfigured, true);
});

test('buildStatus returns configured false when team id is present but key id is missing', async () => {
  const service = createAppleMusicStatusService({
    loadSettingsFn: async () => ({
      providers: {
        appleMusicKeyId: '',
        appleMusicStorefront: 'us',
        appleMusicTeamId: 'TEAM1234',
      },
    }),
    providerCredentialsService: {
      resolveAppleMusicPrivateKey: async () => 'private-key',
    },
  });

  const status = await service.buildStatus({});

  assert.equal(status.configured, false);
  assert.equal(status.teamIdConfigured, true);
  assert.equal(status.keyIdConfigured, false);
  assert.equal(status.privateKeyConfigured, true);
});
