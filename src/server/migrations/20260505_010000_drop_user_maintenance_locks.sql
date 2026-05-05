-- Remove user-managed maintenance locks. The 'maintenance' lock type was used
-- exclusively by the user-facing "Safety holds" UI panel, which has been
-- removed. System-generated locks (restore, upgrade, admin_recovery) continue
-- to use this table and are unaffected.
DELETE FROM maintenance_locks WHERE lock_type = 'maintenance';
