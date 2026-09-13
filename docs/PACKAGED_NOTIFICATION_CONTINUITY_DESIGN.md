# Packaged notification and subscription continuity

Research and design date: September 13, 2026. This document records the implementation contract and recommendations before the acceptance tooling changes. Actual build identities, executed checks, and outcomes belong in a separate outcome document.

## Purpose and current gap

Harmoniarr is a Node 24 ESM application with PostgreSQL 18 embedded in its standard container. Notification delivery now relies on persisted claim tokens, freshness deadlines, registration identity, terminal retention timestamps, and guarded subscription pruning. Source tests and isolated PostgreSQL tests establish those behaviors, but they do not prove that an immutable application image contains the migrations or preserves the data during a packaged upgrade.

The existing `validate:docker-candidate` harness resolves immutable images, verifies runtime identity and hardening, and runs fresh-install, retained-data restart, and baseline-upgrade scenarios. Its packaged schema probe checks the migration manifest and ledger, two Missing Music pagination indexes, recovery tools, and one generated disabled requester and request during upgrade. Fresh/restart has no matching domain continuity fixture, and the index verifier assumes every checked index belongs to `library_wanted_releases`.

Extend that harness with modular notification schema and continuity checks. Do not create another deployment runner or modify application delivery behavior merely to make acceptance easier.

## Chosen artifact boundary

The selected local baseline is source revision `24d9dfb3415a9246d19068779d63d7111095c4bd`, with immutable local image ID `sha256:38634ac85f9615a8511566d57aa17c2beb4e6b86b134748801c215f2d65f5ad6`. Its recorded acceptance result has 98 migrations. The candidate runtime source revision is `d306205345ccb416a94257956b419e61af2d28fd`, containing 104 migrations; build and resolve its immutable identity before the actual run. This slice changes host-side acceptance tooling, not the already selected runtime source.

Keep the existing local-image opt-in and full revision-label validation. Record the candidate identity actually observed after building; do not invent a digest in this design. Do not rebuild, retag, or repull an alternative artifact between acceptance phases. Retain the image-index/platform-manifest/container identity checks already required by the harness.

Docker documents that digests identify fixed content, whereas tags can move, and that a multi-platform index references separate platform manifests. A digest binds bytes; it does not independently establish a trusted source or an accepted release baseline. [Docker image digests](https://docs.docker.com/dhi/explore/security-concepts/digests/).

Provenance records build source and materials. Keep its verification in the existing published-candidate path, separate from local runtime continuity. Docker also documents that build arguments can appear in detailed provenance, so generated runtime fixture secrets must not become build arguments. This work does not publish or dispatch a release, verify a registry attestation by inference, or declare a local image to be an accepted published baseline. [Docker provenance attestations](https://docs.docker.com/build/metadata/attestations/slsa-provenance/).

## Generated fixture

Seed both the fresh candidate database and the baseline database with exactly one generated disabled requester, one review-pending request, one recently invalidated push subscription, and four queue rows: pending, sent, failed, and expired. Each phase pair receives its own owned fixture identities. Keep the original request continuity checks and extend them to fresh-install/restart as well as baseline/upgrade. Perform fresh fixture seeding after the application's administrator bootstrap: inserting any user before bootstrap would change setup eligibility and invalidate the existing smoke flow.

Use synthetic notification content and registration material only. Do not read operator `.env`, saved provider credentials, browser subscriptions, an existing application database, or a media library. Fixture endpoints must be reserved synthetic values, never real provider capabilities. This is direct database fixture setup, not evidence that such an endpoint is accepted by the public registration API.

Give the pending fixture a 365-day future scheduling delay and lifetime so startup or interval delivery cannot claim it during the bounded acceptance run. The disabled requester, invalidated registration, and synthetic endpoint are additional containment, not a substitute for keeping the row ineligible. Seed the three terminal rows and registration invalidation recently enough for their retention policies to preserve them. The subscription is also queue-referenced; do not expect an old unreferenced registration to survive legitimate pruning.

Baseline schemas can lack additive columns. Discover the relevant shape in the image's database before seeding and use a narrow known compatibility branch for those missing columns. Candidate schemas must contain the complete current notification contract. Do not silently skip candidate checks because a column or constraint is absent.

## Schema and continuity checks

Keep SQL execution inside the packaged runtime against its own database and migration manifest. Host source must not be substituted for packaged migration history or loaded as the application implementation. Separate the new notification probe and comparison policy into small ESM files rather than expanding the general serialized schema probe into a large singleton.

Verify the candidate's notification columns, types, defaults where required, constraints, and indexes. Cover queue claim ownership, `expires_at`, `terminal_at`, subscription `registration_token`, terminal retention, and invalidated-subscription pruning/reference indexes. Generalize index verification to include the expected owning table and exact definition rather than assuming all indexes belong to Missing Music. Keep the original pagination indexes, migration checksums, Node/PostgreSQL version requirements, and packaged recovery-tool checks.

Capture and compare durable fixture identity, ownership, payload, event/coalescing metadata, attempts, scheduling, status, and exact timestamps. Subscription endpoint/key material, owner, invalidation state, and identity must remain unchanged. Preserve PostgreSQL microsecond precision, avoiding an implicit conversion to JavaScript millisecond dates for equality checks. Hash endpoint, key, authentication, and payload values inside the probe for internal comparisons so even its captured stdout does not contain those raw values. Exclude those internal hashes from final evidence and diagnostics.

After restart, every captured notification, subscription, requester, and request field must remain equal. After upgrade, every pre-existing field must remain equal, and new fields require explicit migration validation:

- Existing nullable claim state becomes the documented unclaimed state; do not claim a lease was preserved when the baseline had no lease column.
- A newly added registration token must be a valid generated identity; a token already present in the baseline must remain unchanged.
- A newly added queue deadline must match original creation time plus stored TTL, without renewing work at upgrade time.
- A newly added terminal timestamp remains null for pending work, matches recorded sent time for known sent history, and uses the documented migration-time retention baseline for terminal states whose completion time was unknown. Do not present that baseline as a reconstructed failure time.

The migration ledger must still retain every captured prior ID, key, checksum, and applied status, with only the expected forward additions. A matching row count alone cannot prove preservation. A healthy HTTP response or zero pending migrations alone cannot prove the notification schema or fixture survived.

## Evidence contract

Candidate phases must require `notificationSchemaVerified: true` and exact fixture counts. Restart and upgrade must additionally require `notificationContinuityVerified: true` and request continuity; these cannot default to success when absent. The expected fixture is four notifications, one subscription, one disabled requester, and one request. Preserve fixed-schema evidence projection and reject missing or malformed counts, booleans, or phase results before writing a pass artifact.

Keep the full internal comparisons out of the final JSON. Report only allowlisted counts, verification booleans, schema/runtime versions, immutable identities, and existing source labels. Do not emit notification payloads, endpoints, keys, user IDs, usernames, claim tokens, registration tokens, database credentials, raw SQL errors, or host paths. A failure must not leave a populated passed artifact. Evidence is written to a new file and only after all required runtime checks and owned-resource cleanup succeed.

The packaged probe may be host-orchestrated, but imports and database access must execute against the selected image. Unit fixtures are evidence about the verifier's rejection behavior; the actual Docker run is evidence about the packaged runtime. Keep those claims separate in the outcome.

## PostgreSQL and W3C limits

This is an application/schema upgrade within PostgreSQL major 18. PostgreSQL documents `pg_upgrade` as a major-version transition tool and does not require it for minor updates. Do not describe this rehearsal as a PostgreSQL major upgrade, a production restore, or a replacement for the separate dump/restore continuity rehearsal. [PostgreSQL 18 pg_upgrade](https://www.postgresql.org/docs/18/pgupgrade.html), [PostgreSQL cluster upgrades](https://www.postgresql.org/docs/18/upgrading.html).

The W3C Push API distinguishes application-server submission, push-service delivery, and receipt by a service worker. These inert fixtures prove application data and migration continuity. They do not prove provider entitlement, outbound delivery, browser permission, service-worker receipt, displayed notifications, or that a person saw a message. No browser focus, keyboard, status, or layout behavior changes in this slice. [W3C Push API](https://www.w3.org/TR/push-api/).

Retain the existing isolated local Docker fixture, generated credentials, loopback binding, non-root/read-only/capability checks, timeout/error containment, and cleanup verification. The existing fixture does not promise network isolation; this extension must not add a real push send. Published provenance, independent baseline acceptance, ARM64 execution, live provider acceptance, and operator recovery remain separate release evidence.

## Alternatives, pros and cons

| Option | Benefits | Costs and decision |
| --- | --- | --- |
| Rely on source and disposable PostgreSQL tests | Fast and already available. | Does not prove packaged migrations or runtime continuity; insufficient alone. |
| Check only migration counts and health | Small extension. | Can pass with missing data, wrong owners, or incorrect backfills; reject. |
| Reuse candidate acceptance with small notification probes and exact comparisons | Exercises real packaged fresh/restart/upgrade paths and preserves existing isolation/trust checks. | Requires compatibility handling and inert fixture timing; selected. |
| Send real browser push messages during upgrade | Tests additional delivery behavior. | Needs real subscriptions, can create external side effects, and mixes a separate acceptance gate; defer. |
| Build a separate notification deployment harness | Allows bespoke control. | Duplicates lifecycle, identity, evidence, and cleanup logic; reject. |

Recommended stack: existing immutable candidate resolver and Docker fixture; packaged database probe modules; exact field and migration-backfill verification; table-aware schema/index policy; strict allowlisted evidence; focused verifier tests; one actual immutable fresh/restart/upgrade run. Preserve native ESM and reuse the established orchestration boundaries.

## Validation plan

Add focused tests that reject missing candidate notification schema, mutated ownership or content, missing rows, swapped statuses, invalid or regenerated preserved tokens, wrong expiry backfill, incorrect terminal baseline, mismatched microseconds, missing indexes/constraints, and absent evidence fields. Prove malformed or partial results cannot be promoted to a passed candidate artifact.

Run the existing script tests and lint, then execute the immutable candidate command against the selected local baseline and freshly resolved candidate, using `--allow-local-images` explicitly and a new evidence file. Record actual image/platform IDs, revisions, migration counts, tool versions, phase results, and verified cleanup in the outcome. Keep the source full validation and current database recovery checks appropriate to the changes. Do not rerun or claim live provider delivery as part of this fixture.

## Open pull request disposition

Refreshed all open PRs through GitHub MCP on September 13, 2026, then read each complete one-file patch and immutable head. No comment, merge, or remote mutation occurred.

| Pull request | Immutable head | Disposition |
| --- | --- | --- |
| [#40: controlled-provider fixture Node 26](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated runtime-major fixture change; supported application remains Node 24. Not applied. |
| [#24: build action 7.2](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Superseded by local pinned 7.3.0 at `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a`; do not downgrade. |
| [#23: metadata action 6.1](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Superseded by local pinned 6.2.0 at `dc802804100637a589fabce1cb79ff13a1411302`; do not downgrade. |

No open PR contains an applicable notification-continuity patch. Official URLs above were discovered through search or official-page links and opened; local policy and observed artifact claims remain distinct from those sources.
