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

import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute, sanitizePageLimit, sanitizePageOffset } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

function optionalQueryString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildActorUser(session) {
  return {
    id: session.appUserId,
    isDisabled: session.user?.isDisabled === true,
    role: session.user?.role ?? null,
    username: session.user?.username ?? null,
  };
}

export function registerMissingMusicRoutes(app, {
  getMissingMusicDecisionDetail,
  limitMissingMusicDecisionDetailRead = skipRateLimitMiddleware,
  limitMissingMusicDecisionRead = skipRateLimitMiddleware,
  listMissingMusicDecisions,
  requireSession = defaultRequestAuthDependencies.requireSession,
} = {}) {
  if (typeof getMissingMusicDecisionDetail !== 'function') {
    throw new TypeError('registerMissingMusicRoutes requires getMissingMusicDecisionDetail');
  }

  if (typeof listMissingMusicDecisions !== 'function') {
    throw new TypeError('registerMissingMusicRoutes requires listMissingMusicDecisions');
  }

  app.get('/api/v1/missing-music/decisions', limitMissingMusicDecisionRead, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const payload = await listMissingMusicDecisions({
      accountStatus: optionalQueryString(request.query.accountStatus),
      actorUser: buildActorUser(session),
      limit: sanitizePageLimit(request.query.limit, { default: 50, max: 100 }),
      offset: sanitizePageOffset(request.query.offset),
      q: optionalQueryString(request.query.q),
      requestedForUserId: optionalQueryString(request.query.requestedForUserId),
      scope: optionalQueryString(request.query.scope),
      state: optionalQueryString(request.query.state),
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));

  app.get('/api/v1/missing-music/decisions/:decisionId', limitMissingMusicDecisionDetailRead, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const payload = await getMissingMusicDecisionDetail({
      actorUser: buildActorUser(session),
      decisionId: request.params.decisionId,
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));
}
