# Provider status Docker qualification design

October 28, 2026. See [aggregation design](PROVIDER_STATUS_DESIGN.md) and
the separate [Docker outcome](LOCAL_DOCKER_PROVIDER_STATUS_OUTCOME.md).

Use guarded native provider-status and affected Apple-status entries in separate
fresh containers. Each uses immutable packaging, read-only UID-1000, 3 GiB equal
memory/swap, two CPUs, no external network/ports and disposable PostgreSQL/media
tmpfs. Keep overlay preflight separate from final-image proof, with exact removal
and absence checks. Terminate only an independently owned fixture backend, observe
its real query failure/end and pg_stat_activity absence, and retain failed runs.

Verify actual encrypted Apple corruption/recovery, healthy sibling status, scoped
overview behavior, injected non-Apple reader errors, real database 503, current
authorization, no-store and exact settings/secret/settings-audit no-write projections.
Provider HTTP ownership must remain unused; partial status does not qualify live
accounts, token validity or remote connection acceptance.

After focused validation, freeze source and run one full fast gate. Build with a
fresh disposable pull/no-cache BuildKit builder and compare exact packaged server,
shared/client bytes, npm/OS packages and Node binary with the preceding UI image.
Preserve administrator, five bind sources, read-only root and loopback 47956.
Check readiness, automatic schema diagnostics, entrypoint/data-bind cleanup and
the existing Apple UI's actual and controlled partial/unavailable reads. No writes
to operator credentials/settings, manual refresh job or additional deployed app.

Retain unrelated signing/HTTPS/save/OAuth/Plex/session/media proof only after exact
source/test/runtime comparison. No memory minimum, live provider, spoken AT or
physical-device acceptance is inferred. Private evidence stays under
`.tmp/provider-status-2026-10-28/`.
