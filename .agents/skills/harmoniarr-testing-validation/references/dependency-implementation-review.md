# Dependency implementation review

Use when a dependency update crosses a private adapter, serializer, language
server, native binary or other implementation-sensitive boundary. This is a
focused validation workflow, not authorization for an unrelated major migration.

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
