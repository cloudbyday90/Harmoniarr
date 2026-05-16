import assert from 'node:assert/strict';
import test from 'node:test';
import { useNetworkSearchWorkflow } from '../../src/client/composables/useNetworkSearchWorkflow.js';

test('useNetworkSearchWorkflow refreshes status and completes a search', async (t) => {
  const fetchStatus = t.mock.fn(async () => ({ state: 'connected' }));
  const startSearch = t.mock.fn(async () => ({ searchId: 'search-1', state: 'inprogress' }));
  const fetchResponses = t.mock.fn(async () => ([
    {
      fileCount: 4,
      hasFreeUploadSlot: true,
      queueLength: 0,
      totalSize: 4096,
      uploadSpeed: 2048,
      username: 'peer-1',
    },
  ]));
  const fetchSearchState = t.mock.fn(async () => ({ isComplete: true, state: 'completed' }));
  const schedulePoll = t.mock.fn((callback) => {
    callback();
    return 1;
  });

  const workflow = useNetworkSearchWorkflow({
    fetchResponses,
    fetchSearchState,
    fetchStatus,
    schedulePoll,
    startSearch,
  });

  await workflow.refreshStatus();
  assert.equal(workflow.slskdStatus.value.state, 'connected');

  workflow.networkQuery.value = '  Boards of Canada  ';
  await workflow.runNetworkSearch();

  assert.deepEqual(startSearch.mock.calls[0].arguments, [{
    filterResponses: true,
    query: 'Boards of Canada',
    responseLimit: 50,
  }]);
  assert.equal(workflow.hasNetworkSearched.value, true);
  assert.equal(workflow.isNetworkSearching.value, false);
  assert.equal(workflow.totalFiles.value, 4);
  assert.equal(workflow.totalResultBytes.value, 4096);
  assert.equal(schedulePoll.mock.callCount(), 0);
});

test('useNetworkSearchWorkflow surfaces missing search identifiers as start failures', async () => {
  const workflow = useNetworkSearchWorkflow({
    startSearch: async () => ({}),
  });

  workflow.networkQuery.value = 'Autechre';
  await workflow.runNetworkSearch();

  assert.equal(workflow.networkErrorMessage.value, 'slskd did not return a search identifier');
  assert.equal(workflow.isNetworkSearching.value, false);
});

test('useNetworkSearchWorkflow captures polling failures', async () => {
  const workflow = useNetworkSearchWorkflow({
    fetchResponses: async () => {
      throw new Error('poll exploded');
    },
    fetchSearchState: async () => ({ state: 'inprogress' }),
    startSearch: async () => ({ searchId: 'search-1' }),
  });

  workflow.networkQuery.value = 'Tycho';
  await workflow.runNetworkSearch();

  assert.equal(workflow.networkErrorMessage.value, 'poll exploded');
  assert.equal(workflow.isNetworkSearching.value, false);
});
