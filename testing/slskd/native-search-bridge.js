/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { nativeSearchPeers, nativeSearchPlans, resolveNativeSearchPlan } from './native-search-codec.js';

export function createNativeSearchBridge({ docker, fixtureId }, fixtures) {
  const searches = [];
  const call = async (phase, input = {}) => {
    const body = JSON.stringify(input); assert.ok(Buffer.byteLength(body) <= 16384);
    return JSON.parse(await docker(['exec', fixtureId, 'node', '/app/testing/slskd/native-search-cli.js', phase, body]));
  };
  return {
    assertIdle: async () => { assert.equal(searches.length, 0); assert.deepEqual(await call('idle'), { searches: 0 }); },
    service: {
      startSearch: async input => {
        assert.ok(nativeSearchPlans.some(plan => plan.query === input.query), JSON.stringify(input));
        const plan = resolveNativeSearchPlan(input.query);
        const fixture = fixtures.find(row => row.file === plan.file);
        assert.ok(fixture); assert.equal(fixture.searchId, undefined);
        const response = await call('start', input); fixture.searchId = response.search.id;
        searches.push({ ...response, query: input.query }); return response.search;
      },
      getSearchState: input => call('state', input),
      getSearchResponses: input => call('responses', input),
    },
    async finish() {
      assert.equal(searches.length, 2);
      const completed = [];
      for (const row of searches) {
        const state = await call('finish', { searchId: row.search.id });
        assert.equal(state.responseCount, 2); assert.equal(state.fileCount, 2);
        const plan = resolveNativeSearchPlan(row.query);
        const responses = await call('responses', { searchId: row.search.id });
        assert.deepEqual(responses.responses.map(response => response.username).sort(), [...nativeSearchPeers].sort());
        for (const response of responses.responses) {
          assert.deepEqual(response.files, [{ filename: plan.file.filename, size: plan.file.size, extension: 'wav',
            bitRate: 1411, bitDepth: 16, length: 2, sampleRate: 44100, isLocked: false }]);
        }
        completed.push({ searchId: state.id, query: row.query, isComplete: state.isComplete,
          token: state.token, responseCount: state.responseCount, fileCount: state.fileCount,
          responses: responses.responses, calls: row.calls });
      }
      return { boundary: 'native-server-and-compressed-peer-search', searches: completed };
    },
  };
}
