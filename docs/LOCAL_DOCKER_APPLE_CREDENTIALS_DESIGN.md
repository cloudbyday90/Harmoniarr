# Apple credential-save Docker qualification design

October 28, 2026. See [implementation design](APPLE_CREDENTIALS_DESIGN.md) and
the separate [Docker outcome](LOCAL_DOCKER_APPLE_CREDENTIALS_OUTCOME.md).

Use the existing guarded native runner with the new Apple save entry and existing
Apple HTTP entry in separate fresh containers. Each uses immutable candidate
packaging, 3 GiB equal memory/swap, two CPUs, read-only UID-1000, no external
network/ports and disposable PostgreSQL/media tmpfs. Keep overlay preflight
separate from final-image qualification. Require actual stop/removal/absence.

The save entry exercises the real application route, session and CSRF middleware,
settings service, encrypted secret service and native PostgreSQL transaction.
Compare exact stored settings/secret/settings-audit projections around refusals.
Use an owned temporary trigger to fail a secret insert after ID persistence and
prove rollback; do not modify platform migrations or an operator database.
Keep local key representation validation separate from live Apple acceptance.

After focused checks and frozen fast validation, build with a fresh disposable
BuildKit builder using pull/no-cache. Compare exact source/dependency/OS/runtime
and client/shared inventory to the preceding signing image. Retain unrelated
qualification only after exact owner/test/runtime comparison. Preserve the
existing administrator, five bind sources, read-only root and loopback 47956;
verify automatic schema status/readiness, login, data-bind cleanup and reviewed
desktop/mobile screenshots. No manual schema refresh or extra deployed app.

Retain failed candidate records. Neither a small native profile nor unchanged
component comparisons establish a deployment memory minimum, live provider
acceptance or manual assistive-technology/physical-device approval. Private
evidence stays in `.tmp/apple-credentials-2026-10-28/`.
