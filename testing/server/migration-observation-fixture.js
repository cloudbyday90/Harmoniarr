/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createSystemModule } from '/app/server-dist/system-module.js';

/** Controlled provider status only; migration readers, HTTP auth and backup work are real. */
export const createMigrationObservationSystemModule = options => createSystemModule({ ...options,
  musicBrainzSearchService: { checkProviderHealth: async () => ({ status: 'healthy', message: 'Fixture provider reachable.' }) },
  slskdService: { getConnectionStatus: async () => ({ status: 'unavailable', details: { isConnected: false } }) },
});

/** Install only after the disposable database and production startup have been prepared. */
export async function createMigrationObservationGuard(pool) {
  await pool.query('CREATE TABLE fixture_migration_observation_guard (enabled boolean NOT NULL)');
  await pool.query('INSERT INTO fixture_migration_observation_guard VALUES (true)');
  await pool.query(`CREATE FUNCTION fixture_refuse_observation_ddl() RETURNS event_trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF (SELECT enabled FROM fixture_migration_observation_guard) THEN
        RAISE EXCEPTION 'Fixture refuses schema writes during observation' USING ERRCODE='25006';
      END IF;
    END; $$`);
  await pool.query('CREATE EVENT TRIGGER fixture_observation_ddl_guard ON ddl_command_start EXECUTE FUNCTION fixture_refuse_observation_ddl()');
  return {
    setEnabled: enabled => pool.query('UPDATE fixture_migration_observation_guard SET enabled=$1', [enabled]),
    async getCatalogIdentity() {
      return (await pool.query(`SELECT oid::text, xmin::text, md5(pg_get_functiondef(oid)) AS definition_hash
        FROM pg_proc WHERE oid='harmoniarr_generate_uuid'::regproc`)).rows[0];
    },
  };
}
