# Provider callback feedback Docker qualification design

October 28, 2026. See [policy/UI design](PROVIDER_CALLBACK_FEEDBACK_DESIGN.md) and
the separate [Docker outcome](LOCAL_DOCKER_PROVIDER_CALLBACK_FEEDBACK_OUTCOME.md).

Freeze source, run one complete fast gate and built-client browser fixture, then
rebuild through a disposable pull/no-cache builder. Compare exact packaged
server/shared/client bytes, root metadata, dependency versions and Node identity
with the preceding callback-code image. Preserve the existing administrator,
five binds, read-only UID 1000, readiness and loopback port. No additional deployed
app or service is required.

The canonical browser entry uses a disposable app/PostgreSQL fixture and controlled
provider-status replies. Share its scenario with the preserved walkthrough proof.
Keep API mutation guards strict; only login/bootstrap are outside the scenario.
Use actual routes/controls, held reads, retry/recovery, malformed/forged hints and
safe cleanup. Screenshots cover desktop/tablet/mobile and light/dark; browser
dimensions and DOM assertions are separate from assistive-technology acceptance.

On the preserved walkthrough, verify an actual invalid-state callback, fixed
guidance, fresh saved-status GET and unchanged settings/secret status. Do not
start live provider flows or mutate production account state. Retain the prior
143 native callback/OAuth/Plex scenario groups only after exact unchanged server,
shared, test and packaged-runtime comparison. Unchanged memory/SQL/media matrices
need no rerun. Verify builder/helper retirement and preserve failed evidence.
Private evidence belongs under `.tmp/provider-callback-feedback-2026-10-28/`.
