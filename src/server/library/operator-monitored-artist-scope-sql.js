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

export const OPERATOR_MONITORED_ARTIST_SCOPE_CTE = `
  operator_monitored_artist_scope AS (
    SELECT
      operator_artist_monitoring.metadata_artist_id,
      ARRAY_AGG(DISTINCT monitored_type ORDER BY monitored_type) AS monitored_release_group_types
    FROM operator_artist_monitoring
    CROSS JOIN LATERAL unnest(operator_artist_monitoring.monitored_release_group_types) AS monitored_type
    WHERE operator_artist_monitoring.is_monitored = TRUE
    GROUP BY operator_artist_monitoring.metadata_artist_id
  )
`;
