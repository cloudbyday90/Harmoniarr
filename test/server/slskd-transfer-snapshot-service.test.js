import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdTransferSnapshotService } from '../../src/server/slskd/slskd-transfer-snapshot-service.js';

test('buildTransferSnapshot batches removed-download lookups by username and indexes transfers by id', async (t) => {
  const getDownloads = t.mock.fn(async ({ includeRemoved, username }) => {
    assert.equal(includeRemoved, true);

    if (username === 'source-user') {
      return [{
        directories: [{
          files: [{
            bytesTransferred: 1000,
            exception: null,
            filename: 'Autechre\\Amber\\01 Foil.flac',
            id: 'transfer-1',
            size: 1000,
            state: 'Completed, Succeeded',
            username,
          }],
        }],
        username,
      }];
    }

    return [{
      directories: [{
        files: [{
          bytesTransferred: 200,
          exception: null,
          filename: 'Boards of Canada\\Geogaddi\\01 Ready Lets Go.flac',
          id: 'transfer-2',
          size: 1000,
          state: 'Queued, Remotely',
          username,
        }],
      }],
      username,
    }];
  });
  const service = createSlskdTransferSnapshotService({ getDownloads });

  const snapshot = await service.buildTransferSnapshot({
    requestedTransfers: [{
      id: 'transfer-1',
      username: 'source-user',
    }, {
      id: 'transfer-1',
      username: 'source-user',
    }, {
      id: 'transfer-2',
      username: 'other-user',
    }],
  });

  assert.equal(getDownloads.mock.callCount(), 2);
  assert.deepEqual(getDownloads.mock.calls.map((call) => call.arguments[0]), [{
    includeRemoved: true,
    username: 'source-user',
  }, {
    includeRemoved: true,
    username: 'other-user',
  }]);
  assert.equal(snapshot.usernameCount, 2);
  assert.equal(snapshot.requestedTransferCount, 3);
  assert.equal(snapshot.getTransfer({ id: 'transfer-1', username: 'source-user' }).state, 'Completed, Succeeded');
  assert.equal(snapshot.getTransfer({ id: 'transfer-2', username: 'other-user' }).state, 'Queued, Remotely');
  assert.equal(snapshot.getTransfer({ id: 'missing', username: 'source-user' }), null);
});

test('buildTransferSnapshot returns an empty snapshot when no valid transfers are requested', async (t) => {
  const getDownloads = t.mock.fn(async () => []);
  const service = createSlskdTransferSnapshotService({ getDownloads });

  const snapshot = await service.buildTransferSnapshot({
    requestedTransfers: [{ id: '', username: 'source-user' }],
  });

  assert.equal(getDownloads.mock.callCount(), 0);
  assert.equal(snapshot.usernameCount, 0);
  assert.equal(snapshot.requestedTransferCount, 0);
  assert.equal(snapshot.getTransfer({ id: 'transfer-1', username: 'source-user' }), null);
});