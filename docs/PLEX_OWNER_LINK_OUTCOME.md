# Plex owner-link outcome

October 27, 2026. Implemented the owner-link follow-up from the Plex HTTP work.
See [official research, alternatives and recommended stack](PLEX_OWNER_LINK_RESEARCH_2026_10.md),
[design](PLEX_OWNER_LINK_DESIGN.md) and
[packaged qualification](LOCAL_DOCKER_PLEX_OWNER_LINK_OUTCOME.md).

## Delivered behavior

Plex owner linking now requires a dedicated browser verifier and the exact
initiating session's current administrator authority. State is versioned,
encrypted, expires on the database clock and is consumed once using its exact
record identity/ciphertext/revision. Demotion, disablement, required password
change, credential epoch change, session revocation, rotation or expiry refuses
publication. The callback works without the Strict refresh cookie on the
cross-site top-level return because its encrypted grant identifies the session
that must still be valid in PostgreSQL.

State consumption, owner-token replacement, link revision and required audit
commit together. Clear uses the same admission and advances revision, invalidating
older callbacks. Another completed flow also invalidates older flows. Suppressed
secret writes/deletes and missing required audits roll back publication. COMMIT
acknowledgement loss is unavailable without automatic retry or duplicate success.
Provider work holds no database checkout; existing transport and transaction
deadlines retain actual drain ownership.

Policy, state read, SQL store and command owner are separate ESM files. Existing
maintenance automatically expires owner pending state within the same bounded
batch as sign-in pending state. Token/client/revision records are excluded.
Public DTOs and new audit details omit authority verifiers and provider identity.
Existing authorized settings display fields remain available.

## Validation and limits

One frozen fourteen-stage gate passed: 6,323 server, 4,504 client and 703 script/
policy tests, with no failures/skips/cancellations, plus lint, copyright, ESM,
schema/migration/compose checks and build. npm audit reported zero vulnerabilities.
The final guarded owner-link entry passes 33 PostgreSQL/HTTP scenarios; existing
HTTPS/callback/retention/linked-login entries and Chromium proof are recorded
separately in the Docker outcome.

The conservative session binding requires restarting linking if that exact
session rotates, expires or is revoked while away. Existing unbound pending flows
must restart; established linked credentials remain compatible. No live Plex
account, human screen-reader or physical-device acceptance is claimed. Browser
transport is controlled; native HTTPS trust/hostname/close proof is separate.
Historical audit records are unchanged. No schema or dependency change is needed.

GitHub MCP checks returned no open PRs, including no open Dependabot PRs, at both
initial and final checks. There was no random PR to apply locally and no stale
Dependabot PR to rebase or close. No PR was merged. Work stays on main without a
release, tag or separate branch.

## Next recommended item

The Spotify/YouTube follow-up is now implemented in the
[OAuth outcome](OAUTH_LINK_OUTCOME.md), with separate
[official research and tradeoffs](OAUTH_LINK_RESEARCH_2026_10.md). Their protocol
parameters remain provider-specific while local authority, state consumption,
clear/relink and refresh publication are transaction-owned. Next qualify native
HTTP resource lifetime for those providers; Plex PIN behavior is not an OAuth
protocol template.
