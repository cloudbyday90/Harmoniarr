# HTTP error Docker qualification design

October 28, 2026. See [implementation design](HTTP_ERROR_DESIGN.md) and the
separate [Docker outcome](LOCAL_DOCKER_HTTP_ERROR_OUTCOME.md).

Freeze the changed source after focused qualification, run the full fast gate,
then build through a disposable pull/no-cache builder. Compare exact packaged
server/shared/client bytes, npm/OS packages and Node binary with the previous
provider-status image. Preserve the current administrator, all five actual bind
sources, read-only UID 1000 and localhost port 47956.

Use an explicit guarded native HTTP error entry in a fresh disposable PostgreSQL
container. Inject unexpected failures through the app's existing composition,
with no production fixture routes. Qualify intentional validation/auth/CSRF/
bootstrap contracts and parser failures against real HTTP. Native database
connection failure must use only an independently owned fixture connection;
observe its actual error, end and backend absence before disposal. Existing
domain/SQL/worker behavior is not changed by the response projection.

Final native proof runs against immutable packaging without a server overlay,
no external network or ports, two CPUs, 3 GiB memory/equal swap, UID 1000,
read-only root and disposable media/database tmpfs. Remove exact owned helpers
and verify absence. Preserve failed candidates separately.

On the preserved walkthrough, check readiness, actual authentication/validation
errors and automatic schema diagnostics. Browser-local failure overlays may
qualify retry/feedback rendering but must not mutate operator settings. Retain
unrelated media/provider tests only after exact source/runtime comparison. No
memory minimum, live account, spoken screen-reader or physical-device result
is inferred. Evidence stays private under `.tmp/http-errors-2026-10-28/`.
