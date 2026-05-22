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

export const fulfillmentEvidenceSchemaVersion = 1;

const validSourceTypes = new Set(['plex_webhook']);
const validPlexWebhookEvents = new Set([
  'library.new',
  'library.on.deck',
  'media.play',
  'media.pause',
  'media.resume',
  'media.stop',
  'media.scrobble',
  'media.rate',
]);

export const highValuePlexEvents = new Set(['library.new', 'media.scrobble']);

function normalizeText(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCorrelationComponent(value) {
  if (typeof value !== 'string') {
    return null;
  }
  return value.trim().toLowerCase().replace(/\s+/g, ' ') || null;
}

export function deriveCorrelationKey({ artist = null, title = null } = {}) {
  const normalizedArtist = normalizeCorrelationComponent(artist);
  const normalizedTitle = normalizeCorrelationComponent(title);
  const parts = [];
  if (normalizedArtist) parts.push(normalizedArtist);
  if (normalizedTitle) parts.push(normalizedTitle);
  return parts.join('::');
}

export function normalizePlexWebhookPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const event = normalizeText(payload.event);
  if (!event || !validPlexWebhookEvents.has(event)) {
    return null;
  }

  const metadata = payload.Metadata;
  const account = payload.Account;
  const server = payload.Server;

  const librarySectionType = normalizeText(metadata?.librarySectionType);
  if (librarySectionType && librarySectionType !== 'artist') {
    return null;
  }

  const metadataType = normalizeText(metadata?.type);
  const metadataTitle = normalizeText(metadata?.title);
  const metadataArtist = normalizeText(metadata?.grandparentTitle);
  const metadataAlbum = normalizeText(metadata?.parentTitle);

  const correlationKey = deriveCorrelationKey({
    artist: metadataArtist,
    title: metadataAlbum ?? metadataTitle,
  });

  if (!correlationKey) {
    return null;
  }

  return Object.freeze({
    account: {
      id: account?.id != null ? String(account.id) : null,
      title: normalizeText(account?.title),
    },
    correlationKey,
    event,
    metadata: {
      album: metadataAlbum,
      artist: metadataArtist,
      title: metadataTitle,
      type: metadataType,
    },
    rawPayload: Object.freeze({
      event,
      Account: account
        ? { id: account.id, title: account.title }
        : null,
      Metadata: metadata
        ? {
          librarySectionType,
          type: metadataType,
          title: metadataTitle,
          grandparentTitle: metadataArtist,
          parentTitle: metadataAlbum,
          index: metadata?.index,
          parentIndex: metadata?.parentIndex,
          addedAt: metadata?.addedAt,
        }
        : null,
    }),
    server: {
      title: normalizeText(server?.title),
      uuid: normalizeText(server?.uuid),
    },
  });
}

export function buildFulfillmentEvidenceRecord({
  correlationKey,
  normalizedPayload,
  receivedAt,
  expiresAt,
}) {
  return Object.freeze({
    correlationKey,
    expiresAt,
    metadataAlbum: normalizedPayload.metadata.album,
    metadataArtist: normalizedPayload.metadata.artist,
    metadataTitle: normalizedPayload.metadata.title,
    metadataType: normalizedPayload.metadata.type,
    rawPayload: normalizedPayload.rawPayload,
    receivedAt,
    sourceEvent: normalizedPayload.event,
    sourceServerUuid: normalizedPayload.server.uuid,
    sourceType: 'plex_webhook',
  });
}

export function isValidSourceType(value) {
  return validSourceTypes.has(value);
}
