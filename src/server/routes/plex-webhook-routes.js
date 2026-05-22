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

import { asyncRoute } from '../http.js';

const maxBodySizeBytes = 2 * 1024 * 1024;

function parseMultipartFormData(contentType, bodyBuffer) {
  if (typeof contentType !== 'string' || !contentType.includes('multipart/form-data')) {
    return null;
  }

  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  if (!boundaryMatch) {
    return null;
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const delimiter = `--${boundary}`;
  const body = bodyBuffer.toString('utf-8');
  const parts = {};

  const sections = body.split(delimiter);
  for (const section of sections) {
    if (!section || section === '--\r\n' || section === '--') {
      continue;
    }

    const headerEnd = section.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      continue;
    }

    const headers = section.substring(0, headerEnd);
    const content = section.substring(headerEnd + 4).replace(/\r?\n$/, '');

    const nameMatch = headers.match(/name="([^"]+)"/);
    if (!nameMatch) {
      continue;
    }

    parts[nameMatch[1]] = content;
  }

  return parts;
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    request.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxBodySizeBytes) {
        request.destroy();
        reject(new Error('body_too_large'));
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    request.on('error', reject);
  });
}

export function registerPlexWebhookRoutes(app, {
  getWebhookStatus,
  ingestWebhook,
  limitWebhook = (request, response, next) => next(),
}) {
  app.post('/webhooks/plex', limitWebhook, asyncRoute(async (request, response) => {
    const contentType = request.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      response.status(415).json({ ok: false, error: 'unsupported_media_type' });
      return;
    }

    let bodyBuffer;
    try {
      bodyBuffer = await readRawBody(request);
    } catch (error) {
      if (error.message === 'body_too_large') {
        response.status(413).json({ ok: false, error: 'payload_too_large' });
        return;
      }
      throw error;
    }

    const parts = parseMultipartFormData(contentType, bodyBuffer);
    if (!parts || !parts.payload) {
      response.status(400).json({ ok: false, error: 'invalid_multipart_payload' });
      return;
    }

    let rawPayload;
    try {
      rawPayload = JSON.parse(parts.payload);
    } catch {
      response.status(400).json({ ok: false, error: 'invalid_json_payload' });
      return;
    }

    const result = await ingestWebhook({ rawPayload });

    if (!result.accepted) {
      const statusMap = {
        event_not_high_value: 202,
        invalid_payload: 400,
        plex_not_linked: 403,
      };
      const status = statusMap[result.reason] ?? 400;
      response.status(status).json({ ok: false, reason: result.reason });
      return;
    }

    response.status(200).json({
      evidenceId: result.evidenceId,
      matched: result.matched,
      ok: true,
    });
  }));

  app.get('/api/v1/webhooks/plex/status', asyncRoute(async (request, response) => {
    response.json(await getWebhookStatus());
  }));
}
