# Plex owner-link Docker qualification design

October 27, 2026. Freeze source/code bytes, run one fourteen-stage fast gate and
npm audit, then rebuild the existing walkthrough with a fresh pull/no-cache
builder. Preserve its existing administrator and all five inspected bind sources,
including the actual downloads override. Compare immutable server/client/shared
bytes, modes, package/binary versions and metadata before recreation.

Five guarded native entries cover owner linking, existing Plex native HTTPS,
sign-in callback, retention and linked login. Each uses a fresh read-only UID-1000
3 GiB/two-CPU/256-PID container with equal memory/swap cap, network disabled, no
ports and disposable database/media tmpfs. Final production code comes from the
immutable image; test/helper bind mounts are read-only. Preflight overlays and
failed fixture revisions remain separately labeled private evidence.

Owner-link qualification uses real packaged PostgreSQL and mounted HTTP routes
with controlled provider responses. It checks current actor/session after provider
work and account-lock waits, state replay/replacement, independent-flow revision,
clear, required audit and secret-write suppression, final expiry, precommit
visibility, maintenance insertion, bounded pool/lock waits, actual backend
retirement and controlled lost COMMIT acknowledgement. Per-operation checkout
tracking proves provider work runs outside its own checkout. Existing HTTP tests
retain real native TLS/DNS/close qualification; controlled provider responses alone
do not establish live Plex acceptance.

A disposable browser fixture uses the same image and controlled provider transport,
a loopback-only published port and a temporary host TLS proxy. Two isolated
Chromium contexts test Secure host/HttpOnly cookies, cross-site top-level Lax
return with the Strict refresh cookie absent, another browser, stale tabs and
replay. The browser certificate exception is scoped to those fixture contexts;
production TLS policy stays unchanged. Retire the exact fixture process/container,
network, contexts and proxy servers with exit/absence evidence.

Re-run existing live walkthrough login and automatic schema diagnostics with
screenshots at desktop/mobile sizes. This is automated Chromium evidence; human
screen-reader/physical-device acceptance remains deferred. Retain unrelated
password/KDF/session/media qualification only after exact source/test/package
comparison establishes unchanged dependencies. No additional deployed app or
service, release, tag, branch or PR merge is part of this qualification.
