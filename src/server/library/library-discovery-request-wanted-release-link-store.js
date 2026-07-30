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

function requireTransactionalClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('A PostgreSQL transaction client is required to synchronize discovery links.');
  }
}

/**
 * SQL boundary for the many-to-many relationship between a shared discovery
 * request and the operator-owned wanted releases that still need it.
 */
export function createLibraryDiscoveryRequestWantedReleaseLinkStore() {
  async function syncActiveWantedReleaseLinks({ client }) {
    requireTransactionalClient(client);

    await client.query(`
      DELETE FROM library_discovery_request_wanted_release_links AS links
      USING library_discovery_requests
      WHERE library_discovery_requests.id = links.discovery_request_id
        AND NOT EXISTS (
          SELECT 1
          FROM library_wanted_releases
          WHERE library_wanted_releases.id = links.wanted_release_id
            AND library_wanted_releases.metadata_release_id = library_discovery_requests.metadata_release_id
            AND library_wanted_releases.wanted_status IN ('missing', 'partial')
        )
    `);

    await client.query(`
      INSERT INTO library_discovery_request_wanted_release_links (
        discovery_request_id,
        wanted_release_id
      )
      SELECT
        library_discovery_requests.id,
        library_wanted_releases.id
      FROM library_discovery_requests
      JOIN library_wanted_releases
        ON library_wanted_releases.metadata_release_id = library_discovery_requests.metadata_release_id
      WHERE library_wanted_releases.wanted_status IN ('missing', 'partial')
      ON CONFLICT (discovery_request_id, wanted_release_id) DO NOTHING
    `);
  }

  return {
    syncActiveWantedReleaseLinks,
  };
}
