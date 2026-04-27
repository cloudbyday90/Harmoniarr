# Harmoniarr

Harmoniarr is a planned standalone Docker-hosted music library manager inspired by Lidarr, designed around Soulseek as the primary acquisition source.

The current repository contains planning documents while product, architecture, and implementation direction are being finalized.

Harmoniarr is being planned as a self-hosted FOSS application with no SLA or operational warranty. The docs in this repository describe intended behavior and design direction, not a hosted-service support commitment.

- [Planning document](docs/harmoniarr.md)
- [Backup, restore, and upgrade design](docs/BACKUP_RESTORE_DESIGN.md)
- [Bootstrap-admin recovery runbook](docs/ADMIN_RECOVERY_RUNBOOK.md)
- [Security policy and posture](docs/SECURITY_POLICY.md)
- [Security benchmarks](docs/SECURITY_BENCHMARKS.md)
- [Release checklist](release.md)

## Current Direction

The current planning baseline includes a few explicit v1 decisions:

- Local first-run admin setup with Classifarr-style cookie-based browser auth.
- Refresh-token-backed sessions with CSRF protection for cookie-authenticated writes.
- API keys reserved for integrations and automation rather than normal browser administration.
- Explicit path-mapping and staging boundaries between `slskd`, Harmoniarr, and final library roots.
- Staging-first treatment of completed Soulseek downloads before import into the library.

## License

Harmoniarr is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) and [COPYRIGHT.md](COPYRIGHT.md).
