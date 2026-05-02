import assert from 'node:assert/strict';
import test from 'node:test';
import { createYouTubeClient } from '../../src/server/integrations/youtube/youtube-client.js';

test('createYouTubeClient uses API key query authentication when no OAuth token provider is configured', async (t) => {
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
  const client = createYouTubeClient({
    apiKey: 'youtube-key',
    fetchFn,
  });

  await client.listPlaylistItems('playlist-1');

  const requestUrl = new URL(fetchFn.mock.calls[0].arguments[0]);
  assert.equal(requestUrl.searchParams.get('key'), 'youtube-key');
  assert.equal(fetchFn.mock.calls[0].arguments[1].headers, undefined);
});

test('createYouTubeClient prefers OAuth bearer authentication without adding API key', async (t) => {
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
  const client = createYouTubeClient({
    accessTokenProvider: async () => 'youtube-access-token',
    apiKey: 'youtube-key',
    fetchFn,
  });

  await client.listPlaylistItems('playlist-1');

  const requestUrl = new URL(fetchFn.mock.calls[0].arguments[0]);
  assert.equal(requestUrl.searchParams.has('key'), false);
  assert.deepEqual(fetchFn.mock.calls[0].arguments[1].headers, {
    Authorization: 'Bearer youtube-access-token',
  });
});
