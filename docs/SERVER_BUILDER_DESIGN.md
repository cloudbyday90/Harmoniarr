# Dependency-free server assembly

Date: 2026-10-20. Follow the [smoke-port outcome](DOCKER_SMOKE_PORT_OUTCOME.md).
scripts/build-server.js imports only Node filesystem/path/URL builtins and copies
src/server into dist/server. Installing the project's full dependency graph in
that stage performs work that assembly does not consume.

## Change and ownership

Start server-builder directly from the existing digest-pinned Node image instead
of node-base, which installs global npm for the client/runtime. Keep package.json
for the explicit ESM package scope, the build script and server source. Remove
server-stage lock/npmrc/shared copies and run node scripts/build-server.js with
RUN --network=none. Shared source is still copied into the final runtime by its
existing owner. Client and runtime dependency installs retain their current policy.

Keep the existing small ESM assembly script; no extra service, compiler, registry
or manifest-mirroring unit test is needed. If assembly later requires external
packages, review that new dependency rather than restoring a full install by habit.

## Proof and applicability

Build the original server stage before editing. Compare complete path/hash/mode
inventories against a fresh candidate stage, and prove that only the candidate
passes an absent-project-dependencies assertion. Inspect the actual candidate
stage without network access and verify the retained ESM scope. Build a final
image without cache, compare server/shared/client output and physical production
package versions, then exercise fresh/restart and baseline/upgrade with actual
sessions, persistence and owned cleanup. Keep local timings descriptive.

The independently selected PR 51 changes managed slskd to 0.26.1. Its image must
pass the actual download preparation policy as well as startup/API checks before
adoption. Preserve exact provider-version refusal and private-network isolation;
do not expand a transport support guard merely because an API responds.

See [official research and alternatives](SERVER_BUILDER_RESEARCH_2026_10.md) and
the separate [outcome](SERVER_BUILDER_OUTCOME.md).
