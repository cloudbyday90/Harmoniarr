/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const backupSqlGateNamespace=724193;
export const backupSqlFixtureApplication=checkpoint=>'harmoniarr-backup-sql:'+checkpoint;
export async function installBackupSqlCrashGate(pool){
  await pool.query(`
    CREATE FUNCTION fixture_backup_sql_gate() RETURNS trigger LANGUAGE plpgsql AS $gate$
    DECLARE candidate text; phase text;
    BEGIN
      IF TG_OP='DELETE' THEN candidate:=OLD.filename; ELSE candidate:=NEW.filename; END IF;
      IF candidate IS DISTINCT FROM current_setting('harmoniarr.fixture_backup_filename',true)
        OR TG_TABLE_NAME IS DISTINCT FROM current_setting('harmoniarr.fixture_backup_table',true)
        OR TG_OP IS DISTINCT FROM current_setting('harmoniarr.fixture_backup_verb',true) THEN
        IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END IF;
      IF TG_TABLE_NAME='backup_artifact_file_operations' THEN
        IF NEW.operation_type IS DISTINCT FROM current_setting('harmoniarr.fixture_backup_operation',true) THEN RETURN NEW; END IF;
        phase:=current_setting('harmoniarr.fixture_backup_phase',true);
        IF NEW.status IS DISTINCT FROM phase THEN RETURN NEW; END IF;
      END IF;
      PERFORM pg_advisory_xact_lock(${backupSqlGateNamespace},current_setting('harmoniarr.fixture_backup_gate_key')::int);
      IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END $gate$;
    CREATE TRIGGER fixture_backup_sql_journal BEFORE INSERT OR UPDATE ON backup_artifact_file_operations
      FOR EACH ROW EXECUTE FUNCTION fixture_backup_sql_gate();
    CREATE TRIGGER fixture_backup_sql_catalog BEFORE INSERT OR DELETE ON backup_artifacts
      FOR EACH ROW EXECUTE FUNCTION fixture_backup_sql_gate();
  `);
}
export async function configureBackupSqlCrashGate(client,plan){
  for(const [key,value] of Object.entries({application_name:backupSqlFixtureApplication(plan.checkpoint),
    lock_timeout:'10s',statement_timeout:'15s','harmoniarr.fixture_backup_filename':plan.checkpoint+'.json',
    'harmoniarr.fixture_backup_table':plan.table,'harmoniarr.fixture_backup_verb':plan.verb,
    'harmoniarr.fixture_backup_operation':plan.operation,
    'harmoniarr.fixture_backup_phase':plan.phase,'harmoniarr.fixture_backup_gate_key':String(plan.gateKey)})){
    await client.query('SELECT set_config($1,$2,false)',[key,value]);
  }
}
