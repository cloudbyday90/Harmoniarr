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

import { getPool } from './database.js';

export async function recordAuditEvent({
  actorUserId = null,
  actorType,
  eventType,
  summary,
  details = null,
  entityType = null,
  entityId = null,
  ipAddress = null,
  userAgent = null,
}) {
  await getPool().query(
    `
      INSERT INTO audit_events (
        occurred_at,
        actor_user_id,
        actor_type,
        event_type,
        entity_type,
        entity_id,
        summary,
        details,
        ip_address,
        user_agent
      )
      VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
    `,
    [
      actorUserId,
      actorType,
      eventType,
      entityType,
      entityId,
      summary,
      details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
    ],
  );
}