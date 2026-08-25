import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdDownloadHandoffReconciliationService } from '../../src/server/slskd/slskd-download-handoff-reconciliation-service.js';

test('slskd handoff reconciliation requires an exact filename and size match', async () => {
  const service = createSlskdDownloadHandoffReconciliationService({
    getDownloads: async () => [{
      directories: [{
        files: [{
          filename: 'Boards of Canada\\Music Has the Right to Children\\01 Wildlife Analysis.flac',
          id: 'transfer-1',
          size: 123,
        }, {
          filename: 'Boards of Canada\\Music Has the Right to Children\\02 An Eagle in Your Mind.flac',
          id: 'transfer-2',
          size: 999,
        }],
      }],
      username: 'source-user',
    }],
  });

  const result = await service.findMatchingTransfers({
    requestedFiles: [{
      filename: 'Boards of Canada/Music Has the Right to Children/01 Wildlife Analysis.flac',
      size: 123,
    }, {
      filename: 'Boards of Canada\\Music Has the Right to Children\\02 An Eagle in Your Mind.flac',
      size: 456,
    }],
    username: 'source-user',
  });

  assert.equal(result.allRequestedFilesMatched, false);
  assert.equal(result.requestedFileCount, 2);
  assert.deepEqual(result.matchedTransfers.map((transfer) => transfer.id), ['transfer-1']);
  assert.deepEqual(result.missingFiles, [{
    filename: 'Boards of Canada\\Music Has the Right to Children\\02 An Eagle in Your Mind.flac',
    size: 456,
  }]);
});

test('slskd handoff reconciliation does not confirm a matching file from another source user', async () => {
  const service = createSlskdDownloadHandoffReconciliationService({
    getDownloads: async () => [{
      directories: [{
        files: [{
          filename: 'Biosphere\\Substrata\\01 As the Sun Kissed the Horizon.flac',
          id: 'other-user-transfer',
          size: 123,
        }],
      }],
      username: 'other-source-user',
    }],
  });

  const result = await service.findMatchingTransfers({
    requestedFiles: [{
      filename: 'Biosphere\\Substrata\\01 As the Sun Kissed the Horizon.flac',
      size: 123,
    }],
    username: 'intended-source-user',
  });

  assert.equal(result.allRequestedFilesMatched, false);
  assert.deepEqual(result.matchedTransfers, []);
});
