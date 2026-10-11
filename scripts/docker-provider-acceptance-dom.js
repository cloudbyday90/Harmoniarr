/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { summarizeMusicQueueTransferLinkage } from './downloader-music-queue-evidence.js';

export async function openDownloaderQueueSnapshot({ baseUrl, page, timeoutMs }) {
  const origin = new URL(baseUrl).origin;
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.origin === origin && url.pathname === '/api/v1/downloader/queue';
  }, { timeout: timeoutMs });
  // Navigation failure must not leave a later rejected response wait unobserved.
  void responsePromise.catch(() => {});
  await page.goto(`${baseUrl}/app/downloader`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { exact: true, name: 'Downloader' }).waitFor({ timeout: timeoutMs });
  const response = await responsePromise;
  if (!response.ok()) throw new Error('The mounted Downloader queue did not load successfully.');
  const downloaderQueue = await response.json();
  const queue = downloaderQueue?.downloader ?? downloaderQueue;
  const { totalTransferCount } = summarizeMusicQueueTransferLinkage(downloaderQueue);
  if (!Array.isArray(queue?.transfers) || queue?.queueHealth?.counts?.total !== totalTransferCount) {
    throw new Error('The mounted Downloader queue has inconsistent transfer counts.');
  }
  const transferQueueCard = page.locator('article.downloader-transfer-queue').filter({
    has: page.getByRole('heading', { exact: true, name: 'Transfer Queue' }),
  });
  const transferLabel = totalTransferCount === 1 ? 'transfer' : 'transfers';
  await transferQueueCard.locator('p.hx-card-subtitle').getByText(
    `Showing ${totalTransferCount} of ${totalTransferCount} ${transferLabel}.`,
    { exact: true },
  ).waitFor({ timeout: timeoutMs });
  return { downloaderQueue, transferQueueCard };
}

export async function waitForDownloadAcceptanceDiagnosticPanel({
  disclosure,
  page,
  timeoutMs,
  title,
}) {
  const label = page.getByText('Download acceptance diagnostic', { exact: true })
    .and(page.locator('p.eyebrow'));
  const diagnosticTitle = page.getByText(title, { exact: true })
    .and(page.locator('strong'));
  const panel = disclosure.locator('article.execution-diagnostic-panel:visible')
    .filter({ has: label })
    .filter({ has: diagnosticTitle })
    .first();

  await panel.getByText('Download acceptance diagnostic', { exact: true })
    .and(panel.locator('p.eyebrow')).waitFor({ timeout: timeoutMs });
  await panel.getByText(title, { exact: true })
    .and(panel.locator('strong')).waitFor({ timeout: timeoutMs });
  return panel;
}
