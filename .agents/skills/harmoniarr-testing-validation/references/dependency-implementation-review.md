# Dependency implementation review

Use when a dependency update crosses a private adapter, serializer, language
server, native binary or other implementation-sensitive boundary. This is a
focused validation workflow, not authorization for an unrelated major migration.

For Node baselines, distinguish the active executable, exact canonical validation
pin and supported package range. A project-scoped PATH does not replace the OS
installation; a Docker tag/digest does not prove its packaged runtime executes.
Keep builder/runtime libc families compatible and verify actual image ID plus
Node/npm at fresh start and restart. A scheduled security announcement is not a
published patch. The worked example is docs/NODE_24_BASELINE_OUTCOME.md; preserve
failed candidate and CI-contract evidence before freezing the corrected source.

1. Discover the current PR and official source URLs through MCP metadata/search.
   Record immutable head/base, actual installed versions and lock integrity.
   Separate vendor/public contracts from private implementation assumptions.
2. Inspect published old/new package bytes as well as upstream source. Follow
   transitive runtime owners: pg queue, client/connection and pg-protocol writer
   are separate packages. A patch number or changelog omission is insufficient.
3. Map each changed surface to its application/fixture caller and observable
   contract. Keep irrelevant libpq, Cloudflare, pipeline or browser paths marked
   unverified rather than claiming their coverage from another path's success.
4. Apply a randomly selected PR locally if requested. Preserve exact opening and
   candidate bytes, install with lifecycle scripts disabled where practical and
   test the earliest meaningful consumer. Retain failure evidence; restore both
   package files and reinstall before testing the restored baseline. A compiler
   version command alone does not prove language-server initialization.
   For an old PR base, apply only its reviewed JSON delta against current files;
   reject conflicting leaves. Replacing its whole lockfile can silently undo
   previously qualified upgrades. Record partial group adoption explicitly.
5. Extend exact reviewed tuples only after implementation review. Include
   serialization dependencies when observing serialized startup writes. Preserve
   class/method refusal, Error/null, timeout and cleanup semantics. An unsupported
   diagnostic adapter must not prevent ordinary native checkout.
6. Run focused adverse controls, then affected native owner files once as a
   serial group, then the appropriate broad gate on stable source. Freeze source
   including package JSON/lock bytes before/after native work. Report selected
   versus complete inventory, failed collections and platform/TLS limits.
7. Document design, sourced alternatives and actual outcome separately. Leave
   unrelated group upgrades pending. Do not infer a vulnerability or whole-CI
   speedup from a compatibility gate or one selected local timing.

The October 19 worked example is docs/POSTGRES_DRIVER_8231_DESIGN.md and
docs/POSTGRES_DRIVER_8231_OUTCOME.md. Random PR 48 demonstrates why real consumer
initialization matters; PR 46's pg subtree can be reviewed independently of its
other Express/Vue/router upgrades. Next native TLS work must verify actual
certificate identity, not just TLS stream creation or an injected success flag.

The subsequent TLS implementation is documented in
docs/POSTGRES_TLS_IDENTITY_OUTCOME.md. Keep real certificate/name and unknown-CA
controls separate from X509 fixture checks. Native pg queues startup before the
handshake: retain that local milestone on failure while requiring absent
secureConnect/authentication/readiness. Verify authorized separately on success.
Await raw and replacement TLS socket close, restore owned hooks, then retire the
server before removing certificate files. Retain workspaces after uncertain
creation/retirement. Controlled held-cleanup tests do not establish active native
cancellation coverage. PR 44's parser/cover/tag evidence remains a separate scope.

## Runtime and development-tool consumers

The runtime example is docs/RUNTIME_DEPENDENCY_QUALIFICATION_DESIGN.md and its
outcome. A reproducible vendor issue needs its exact trigger and a negative
control, then a separate search for application applicability. Keep a working
dependency when the candidate introduces that failure; avoid blanket wrappers
or private vendor patches without a product need.

For Vue tooling, distinguish the language server's document/HTML features from
TypeScript-plugin script/template types. Probe real requests with the retained
compiler and bridge actual tsserver/request responses; do not substitute a mock
or expect every semantic hover from Vue's service. Await protocol exit writes
before ending stdin, then verify shutdown and process close. A private harness
import/shutdown error is not evidence of a dependency regression. PR 45's example
is docs/OPEN_PR_45_LOCAL_EVALUATION_OUTCOME.md.

For HTTP qualification, use actual sessions and PostgreSQL rows. Establish the
effective security mode explicitly; a default-disabled fixture cannot prove
required CSRF refusal. Verify missing/invalid tokens, role changes, revocation,
unchanged refused writes and a valid persisted mutation. Report a policy/default
gap separately from the upgraded dependency's compatibility result.

For lazy navigation, exercise the actual built application with rendered links,
new chunk requests, child replacement and history. A per-document marker detects
reloads that would conceal router failure. Bind source/lock and built assets
before/after; programmatic focus plus Enter does not prove sequential Tab order
or whole WCAG conformance. A language-server upgrade needs initialize, an actual
document request, shutdown and process close using the retained compiler API.

Default protection now has dedicated evidence in
docs/CSRF_DEFAULT_PROTECTION_OUTCOME.md. Seed old saved/missing settings before
app creation rather than enabling required mode during a supposed default test.
Prove bootstrap/login/refresh exceptions, token rotation and a real UI mutation;
the successful headerless opt-out control must remain intentional. Borrow/release
the schema-preparation wrapper's client; that wrapper exposes connect, not the
entire pool query API. Report changed fixtures and rejected candidates separately.
