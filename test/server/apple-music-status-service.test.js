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
  assert.deepEqual(status.localSigning, { state: 'incomplete', checks: { teamId: 'missing', keyId: 'missing', privateKey: 'missing' } });
});

test('buildStatus preserves configured presence while reporting invalid local signing material', async () => {
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
  assert.deepEqual(status.localSigning, { state: 'invalid', checks: { teamId: 'invalid', keyId: 'valid', privateKey: 'invalid' } });
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
  assert.equal(status.localSigning.state, 'invalid');
});

test('buildStatus forwards the borrowed queryable and captures settings before the secret await', async () => {
  const queryable = {}, providers = { appleMusicTeamId: '', appleMusicKeyId: '', appleMusicStorefront: 'gb' };
  const service = createAppleMusicStatusService({
    getPoolFn: () => { throw new Error('unexpected default pool'); },
    loadSettingsFn: async target => { assert.equal(target, queryable); return { providers }; },
    providerCredentialsService: { resolveAppleMusicPrivateKey: async target => {
      assert.equal(target, queryable); providers.appleMusicTeamId = 'TESTTEAM01'; providers.appleMusicStorefront = 'ca'; return null;
    } },
  });
  const status = await service.buildStatus(queryable);
  assert.equal(status.teamIdConfigured, false); assert.equal(status.storefront, 'gb');
  assert.equal(status.localSigning.checks.teamId, 'missing');
});

test('buildStatus reads current values again rather than retaining a prior validation result', async () => {
  let value = null, reads = 0;
  const service = createAppleMusicStatusService({ getPoolFn: () => ({}),
    loadSettingsFn: async () => ({ providers: { appleMusicTeamId: 'TESTTEAM01', appleMusicKeyId: 'TESTKEY001' } }),
    providerCredentialsService: { resolveAppleMusicPrivateKey: async () => { reads++; return value; } },
  });
  assert.equal((await service.buildStatus()).localSigning.state, 'incomplete');
  value = 'PRIVATE-status-sentinel'; assert.equal((await service.buildStatus()).localSigning.state, 'invalid');
  value = null; assert.equal((await service.buildStatus()).localSigning.state, 'incomplete'); assert.equal(reads, 3);
});

for (const owner of ['settings', 'secret']) test(`buildStatus sanitizes ${owner} read failures without reporting invalid credentials`, async () => {
  for (const code of [undefined, 'ECONNREFUSED', '57P01']) {
    const failure = Object.assign(new Error('PRIVATE-status-sentinel'), { code });
    const service = createAppleMusicStatusService({ getPoolFn: () => ({}),
      loadSettingsFn: async () => { if (owner === 'settings') throw failure; return { providers: {} }; },
      providerCredentialsService: { resolveAppleMusicPrivateKey: async () => { throw failure; } },
    });
    await assert.rejects(service.buildStatus(), error => error.status === (code ? 503 : 500)
      && error.code === (code ? 'database_unavailable' : 'apple_music_status_unavailable')
      && error.cause === undefined && !error.message.includes('PRIVATE-status-sentinel'));
  }
});
