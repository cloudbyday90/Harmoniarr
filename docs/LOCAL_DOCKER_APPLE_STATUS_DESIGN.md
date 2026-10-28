# Apple local status Docker qualification design

October 28, 2026. See [implementation design](APPLE_STATUS_DESIGN.md) and
the separate [Docker outcome](LOCAL_DOCKER_APPLE_STATUS_OUTCOME.md).

Run a guarded native Apple status entry against the actual packaged application,
HTTP/session middleware, encrypted owner and PostgreSQL. Use a fresh 3 GiB equal
memory/swap, two-CPU, UID-1000 read-only container with no external network/ports
and disposable database/media tmpfs. Require actual container removal and absence.
Keep overlay preflight separate from immutable final-image evidence.

Exercise missing/partial/valid/invalid inputs, stored-over-environment precedence,
rotation, clear/fallback, malformed ciphertext and healthy recovery. Seed legacy
invalid settings directly only inside this disposable fixture. Compare exact
settings, secret and settings-audit projections across reads, verify no-store
headers and authenticated/requester/current-role behavior, and observe zero
provider-HTTP calls through the application's injected owner. Local validity does
not prove Apple acceptance. Test system-overview integration as the other consumer.

Freeze source and pass one complete fast gate. Build with a fresh disposable
pull/no-cache BuildKit builder and compare exact source/package/OS/Node/client/
shared inventory against the preceding credentials image. Preserve the existing
administrator, five bind sources, loopback 47956 and read-only root. Check login,
readiness, automatic schema diagnostics, data-bind cleanup and reviewed desktop/
mobile screenshots. No extra deployed app or manual schema refresh.

Retain unrelated signer/save/native HTTP/OAuth/media evidence only after exact
owner/test/package/runtime comparison. Preserve failures and verify all owned
builders, containers and temporary password files retire. No memory minimum,
live Apple, manual AT or physical-device acceptance is inferred. Private records
stay in `.tmp/apple-status-2026-10-28/`.
