/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { assertLocatorFocused } from './keyboard-accessibility-helpers.js';

export async function searchCatalogReleases(page, baseUrl, query) {
  await page.goto(`${baseUrl}/app/search`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { exact: true, name: 'Search' }).waitFor();
  await page.getByLabel('Search for an artist or release').fill(query);
  await page.getByRole('button', { name: 'Search' }).click();

  const releasesList = page.getByRole('list', { name: 'Release search results' });
  await releasesList.getByText('Music Has the Right to Children').waitFor();
  return releasesList;
}

export async function openRequestConfirmationFromCard(page, releasesList, releaseTitle) {
  const requestButton = releasesList.getByRole('button', {
    name: `Request ${releaseTitle}`,
  });
  await requestButton.waitFor();
  await requestButton.focus();
  await assertLocatorFocused(requestButton, `${releaseTitle} Request button should be focused`);
  await requestButton.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Request this release?' });
  await dialog.waitFor();
  return dialog;
}

export async function openGeogaddiReleaseDetail(page, baseUrl) {
  await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { exact: true, name: 'Boards of Canada' }).waitFor();
  await page.getByRole('heading', { exact: true, name: 'Albums' }).waitFor();

  const albumsList = page.getByRole('list', { name: /^albums$/iu });
  const geogaddiCard = albumsList.getByRole('button', { name: 'View details for Geogaddi' });
  await geogaddiCard.waitFor();
  await geogaddiCard.focus();
  await assertLocatorFocused(geogaddiCard, 'Geogaddi card should be focused before opening Release Detail');
  await geogaddiCard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Release detail' });
  await dialog.waitFor();
  await dialog.getByText('Ready Lets Go').waitFor();
  return { dialog, geogaddiCard };
}
