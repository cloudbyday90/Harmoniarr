/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const BASE_ACQUISITION_SECTIONS = Object.freeze([
  Object.freeze({ name: 'acquisition', label: 'Overview' }),
  Object.freeze({ name: 'acquisition-music-queue', label: 'Music Queue' }),
]);

const DOWNLOADER_SECTION = Object.freeze({
  name: 'acquisition-downloader',
  label: 'Downloader',
});

/**
 * Builds the stable Acquisition secondary navigation. The Downloader endpoint
 * is deliberately omitted for callers that cannot view the protected queue.
 * Server-side authorization remains authoritative for the route's data.
 *
 * @param {boolean} canViewDownloader
 * @returns {readonly {name: string, label: string}[]}
 */
export function buildAcquisitionWorkspaceSections(canViewDownloader) {
  return canViewDownloader
    ? Object.freeze([...BASE_ACQUISITION_SECTIONS, DOWNLOADER_SECTION])
    : BASE_ACQUISITION_SECTIONS;
}
