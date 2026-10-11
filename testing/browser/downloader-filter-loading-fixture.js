/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/** Controls only the isolated browser's queue GET; provider commands are never submitted. */
export async function installControlledDownloaderQueue(browserContext, initialQueue) {
  const firstRequest = Promise.withResolvers();
  const release = Promise.withResolvers();
  const work = new Set();
  let queue = initialQueue;
  let firstStatus = 200;
  let reads = 0;

  await browserContext.route('**/api/v1/downloader/queue**', (route) => {
    const operation = (async () => {
      if (route.request().method() !== 'GET') throw new Error('Queue fixture accepts only GET.');
      const isFirst = ++reads === 1;
      if (isFirst) {
        firstRequest.resolve();
        await release.promise;
      }
      await route.fulfill({ status: isFirst ? firstStatus : 200,
        json: isFirst && firstStatus !== 200
          ? { error: 'Controlled queue load failed.' }
          : { ok: true, downloader: queue } });
    })();
    work.add(operation);
    void operation.then(() => work.delete(operation), () => work.delete(operation));
    return operation;
  });

  return {
    firstRequest: firstRequest.promise,
    get reads() { return reads; },
    releaseFirst({ status = 200 } = {}) { firstStatus = status; release.resolve(); },
    setQueue(nextQueue) { queue = nextQueue; },
    async drain() { release.resolve(); await Promise.all([...work]); },
  };
}
