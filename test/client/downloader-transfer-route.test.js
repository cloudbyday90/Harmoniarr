import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDownloaderTransferKey,
  buildDownloaderTransferLocation,
  normalizeDownloaderTransferRouteQuery,
  omitDownloaderTransferRouteQuery,
} from '../../src/client/lib/downloader-transfer-route.js';

test('buildDownloaderTransferLocation creates a details route for a live transfer', () => {
  assert.deepEqual(buildDownloaderTransferLocation({
    id: 'transfer-1',
    username: 'source-user',
  }), {
    name: 'acquisition-downloader',
    query: {
      open: 'details',
      transferId: 'transfer-1',
      username: 'source-user',
    },
  });
});

test('buildDownloaderTransferLocation accepts normalized Downloader rows', () => {
  assert.deepEqual(buildDownloaderTransferLocation({
    id: 'transfer-2',
    sourceUser: 'source-user-2',
  }), {
    name: 'acquisition-downloader',
    query: {
      open: 'details',
      transferId: 'transfer-2',
      username: 'source-user-2',
    },
  });
});

test('buildDownloaderTransferLocation returns null when transfer identity is incomplete', () => {
  assert.equal(buildDownloaderTransferLocation({ id: 'transfer-1' }), null);
  assert.equal(buildDownloaderTransferLocation({ username: 'source-user' }), null);
});

test('normalizeDownloaderTransferRouteQuery builds the transfer key from query values', () => {
  assert.deepEqual(normalizeDownloaderTransferRouteQuery({
    open: 'details',
    transferId: 'transfer-1',
    username: 'source-user',
  }), {
    id: 'transfer-1',
    open: 'details',
    transferKey: 'source-user::transfer-1',
    username: 'source-user',
  });
});

test('buildDownloaderTransferKey returns an empty string without a full identity', () => {
  assert.equal(buildDownloaderTransferKey({ id: 'transfer-1' }), '');
  assert.equal(buildDownloaderTransferKey({ username: 'source-user' }), '');
});

test('omitDownloaderTransferRouteQuery removes only handoff query keys', () => {
  assert.deepEqual(omitDownloaderTransferRouteQuery({
    filter: 'active',
    open: 'details',
    transferId: 'transfer-1',
    username: 'source-user',
  }), {
    filter: 'active',
  });
});
