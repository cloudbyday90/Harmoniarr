import assert from 'node:assert/strict';
import test from 'node:test';
import { createProviderClientResolverService } from '../../src/server/integrations/providers/provider-client-resolver-service.js';

test('resolveProviderClients builds enabled provider clients from settings and stored secrets', async (t) => {
  const createSpotifyClientFn = t.mock.fn((config) => ({ provider: 'spotify', config }));
  const createYouTubeClientFn = t.mock.fn((config) => ({ provider: 'youtube', config }));
  const createAppleMusicClientFn = t.mock.fn((config) => ({ provider: 'apple_music', config }));
  const queryable = {};

  const service = createProviderClientResolverService({
    createAppleMusicClientFn,
    createSpotifyClientFn,
    createYouTubeClientFn,
    getPoolFn: () => queryable,
    loadSettingsFn: async () => ({
      providers: {
        appleMusicEnabled: true,
        appleMusicKeyId: 'apple-key',
        appleMusicStorefront: 'gb',
        appleMusicTeamId: 'apple-team',
        playlistExpansionPolicy: 'artist_discovery',
        requestTimeoutMs: 12000,
        spotifyClientId: 'spotify-client',
        spotifyEnabled: true,
        youtubeEnabled: true,
      },
    }),
    providerCredentialsService: {
      resolveAppleMusicPrivateKey: async (input) => {
        assert.equal(input, queryable);
        return 'apple-private-key';
      },
      resolveSpotifyClientSecret: async (input) => {
        assert.equal(input, queryable);
        return 'spotify-secret';
      },
      resolveYoutubeApiKey: async (input) => {
        assert.equal(input, queryable);
        return 'youtube-key';
      },
    },
    spotifyOAuthService: {
      resolveAccessToken: async (input) => {
        assert.equal(input, queryable);
        return null;
      },
    },
    youtubeOAuthService: {
      resolveAccessToken: async (input) => {
        assert.equal(input, queryable);
        return null;
      },
    },
  });

  const clients = await service.resolveProviderClients();

  assert.equal(clients.settings.appleMusicStorefront, 'gb');
  assert.equal(clients.settings.playlistExpansionPolicy, 'artist_discovery');
  assert.deepEqual(clients.spotify.config, {
    clientId: 'spotify-client',
    clientSecret: 'spotify-secret',
    requestTimeoutMs: 12000,
  });
  assert.deepEqual(clients.youtube.config, {
    apiKey: 'youtube-key',
    requestTimeoutMs: 12000,
  });
  assert.deepEqual(clients.appleMusic.config, {
    keyId: 'apple-key',
    privateKey: 'apple-private-key',
    requestTimeoutMs: 12000,
    teamId: 'apple-team',
  });
});

test('resolveProviderClients omits clients when providers are disabled or secrets are missing', async (t) => {
  const createSpotifyClientFn = t.mock.fn(() => ({}));
  const service = createProviderClientResolverService({
    createSpotifyClientFn,
    getPoolFn: () => ({}),
    loadSettingsFn: async () => ({
      providers: {
        playlistExpansionPolicy: 'bounded',
        requestTimeoutMs: 15000,
        spotifyClientId: 'spotify-client',
        spotifyEnabled: true,
        youtubeEnabled: false,
      },
    }),
    providerCredentialsService: {
      resolveAppleMusicPrivateKey: async () => null,
      resolveSpotifyClientSecret: async () => null,
      resolveYoutubeApiKey: async () => null,
    },
    spotifyOAuthService: {
      resolveAccessToken: async () => null,
    },
    youtubeOAuthService: {
      resolveAccessToken: async () => null,
    },
  });

  const clients = await service.resolveProviderClients();

  assert.equal(clients.spotify, undefined);
  assert.equal(clients.youtube, undefined);
  assert.equal(clients.appleMusic, undefined);
  assert.equal(createSpotifyClientFn.mock.callCount(), 0);
});

test('resolveProviderClients prefers linked Spotify OAuth access token over client credentials', async (t) => {
  const createSpotifyClientFn = t.mock.fn((config) => ({ provider: 'spotify', config }));
  const service = createProviderClientResolverService({
    createSpotifyClientFn,
    getPoolFn: () => ({}),
    loadSettingsFn: async () => ({
      providers: {
        playlistExpansionPolicy: 'bounded',
        requestTimeoutMs: 15000,
        spotifyClientId: 'spotify-client',
        spotifyEnabled: true,
      },
    }),
    providerCredentialsService: {
      resolveAppleMusicPrivateKey: async () => null,
      resolveSpotifyClientSecret: async () => {
        throw new Error('client credentials should not be resolved when OAuth is linked');
      },
      resolveYoutubeApiKey: async () => null,
    },
    spotifyOAuthService: {
      resolveAccessToken: async () => 'user-access-token',
    },
    youtubeOAuthService: {
      resolveAccessToken: async () => null,
    },
  });

  const clients = await service.resolveProviderClients();

  assert.equal(clients.spotify.provider, 'spotify');
  assert.equal(typeof clients.spotify.config.accessTokenProvider, 'function');
  assert.equal(await clients.spotify.config.accessTokenProvider(), 'user-access-token');
  assert.equal(clients.spotify.config.requestTimeoutMs, 15000);
});

test('resolveProviderClients prefers linked YouTube OAuth access token over API key', async (t) => {
  const createYouTubeClientFn = t.mock.fn((config) => ({ provider: 'youtube', config }));
  const service = createProviderClientResolverService({
    createYouTubeClientFn,
    getPoolFn: () => ({}),
    loadSettingsFn: async () => ({
      providers: {
        playlistExpansionPolicy: 'bounded',
        requestTimeoutMs: 15000,
        youtubeEnabled: true,
      },
    }),
    providerCredentialsService: {
      resolveAppleMusicPrivateKey: async () => null,
      resolveSpotifyClientSecret: async () => null,
      resolveYoutubeApiKey: async () => {
        throw new Error('API key should not be resolved when OAuth is linked');
      },
    },
    spotifyOAuthService: {
      resolveAccessToken: async () => null,
    },
    youtubeOAuthService: {
      resolveAccessToken: async () => 'youtube-access-token',
    },
  });

  const clients = await service.resolveProviderClients();

  assert.equal(clients.youtube.provider, 'youtube');
  assert.equal(typeof clients.youtube.config.accessTokenProvider, 'function');
  assert.equal(await clients.youtube.config.accessTokenProvider(), 'youtube-access-token');
  assert.equal(clients.youtube.config.requestTimeoutMs, 15000);
});
