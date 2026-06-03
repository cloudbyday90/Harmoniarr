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

const maxBodySizeBytes = 256 * 1024;
const webhookSecretHeader = 'x-harmoniarr-webhook-secret';

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

function extractProvidedSecret(request) {
  const headerSecret = request.headers[webhookSecretHeader];
  if (typeof headerSecret === 'string' && headerSecret.length > 0) {
    return headerSecret;
  }

  const authorization = request.headers.authorization;
  if (typeof authorization === 'string') {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

export function registerSlskdWebhookRoutes(app, {
  ingestWebhookEvent,
  limitSlskdWebhook = (request, response, next) => next(),
}) {
  app.post('/webhooks/slskd', limitSlskdWebhook, asyncRoute(async (request, response) => {
    const contentType = request.headers['content-type'];
    if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
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

    let rawPayload;
    try {
      rawPayload = JSON.parse(bodyBuffer.toString('utf8'));
    } catch {
      response.status(400).json({ ok: false, error: 'invalid_json_payload' });
      return;
    }

    const result = await ingestWebhookEvent({
      providedSecret: extractProvidedSecret(request),
      rawPayload,
    });

    response.status(202).json({
      ok: true,
      provider: 'slskd',
      ...result,
    });
  }));
}
