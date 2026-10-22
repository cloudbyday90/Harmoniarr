/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createArtworkModule } from '../../src/server/artwork/artwork-module.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';
import { createProviderCredentialsService } from '../../src/server/integrations/providers/provider-credentials-service.js';
import { createFanartTvClient } from '../../src/server/integrations/fanart-tv/fanart-client.js';

export const albumId = '1b022e01-4da6-387b-8658-8678046e4cef';
export const otherAlbumId = '00000000-0000-4000-8000-000000000001';
export const cover = { id: 'fixture-cover', url: 'https://assets.fanart.tv/fixture-cover.jpg', likes: '7', lang: '' };

// The real credentials owner and module compose the real client. Only encrypted
// persistence and downstream image/assignment effects are replaced; no live keys.
export function createFanartWiringFixture({ fetchImpl, env = {} } = {}) {
  const saved = new Map();
  let unavailable = false;
  const providerCredentialsService = createProviderCredentialsService({ env, encryptedSecretService: {
    getSecretValue: async ({ name }) => {
      if (unavailable) throw new Error('fixture-private-secret-store-failure');
      return saved.get(name) ?? null;
    },
    setSecretValue: async ({ name, plaintextValue }) => saved.set(name, plaintextValue),
    clearSecretValue: async ({ name }) => saved.delete(name),
  } });
  let client;
  createArtworkModule({ providerCredentialsService,
    createFanartTvClient: options => {
      client = createFanartTvClient({ ...options, ...(fetchImpl ? { fetchImpl } : {}), maxRetries: 0 });
      return client;
    },
    artworkFetchService: {},
  });
  const downloads = []; const ingestions = []; const assignments = [];
  const service = createArtworkFetchService({ fanartTvClient: client,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }) },
    listArtworkAssignmentsFn: async () => [],
    downloadImageFn: async url => { downloads.push(url); return Buffer.from('fixture image'); },
    artworkIngestionService: { ingestArtworkBuffer: async input => { ingestions.push(input); return { asset: { id: 'fixture-asset' } }; } },
    artworkAssignmentService: { assignPreferredArtwork: async input => { assignments.push(input); } },
  });
  return { client, downloads, ingestions, assignments,
    mutateKeys: async providers => {
      const mutation = providerCredentialsService.buildSecretMutation({ providers });
      await mutation.apply();
      return mutation.sanitizedPatch;
    },
    failCredentials: () => { unavailable = true; },
    resolveAlbum: () => service.resolveArtwork({ ownerId: albumId, ownerType: 'musicbrainz_release_group', artworkRole: 'cover_front' }),
  };
}
