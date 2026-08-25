# Controlled Provider Downloader Music Queue Linkage Design

## Status

Implemented on 2026-08-25. This document defines the deterministic Docker
acceptance proof for the Music Queue-to-Downloader handoff.

## Problem

The external-provider probe can prove the visible handoff only after an owner
has configured slskd and accepted a real transfer. That is useful operational
evidence, but it cannot run safely in every development or CI environment.

The isolated controlled-provider pipeline already proves shared discovery,
selection, fallback, and Music Queue states. It did not ask the packaged
Downloader read model whether the fallback transfer resolves to the
correct Music Queue release for each operator. A regression in that scope
boundary could therefore leave a plausible Music Queue state while removing an
operator's useful Downloader handoff.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) | Status messages must be programmatically determinable without moving focus; native controls provide a dependable name/role/value base. | Do not add a second control or notification surface. Keep the existing native Downloader filter and status behaviour; prove the data contract beneath it. |
| [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) | A dependent service should wait for an explicit health check when readiness matters. | Reuse the isolated Compose stack's health-gated application and internal provider rather than a host provider. |
| [slskd configuration](https://github.com/slskd/slskd/blob/master/docs/config.md) | Provider directories must exist and be writable; remote configuration/file management carry exposure risk and are disabled by default. | Keep the fixture internal, capability-reduced, API-key protected, and mounted only to a temporary workspace. No owner credentials or provider setting are needed. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Require the owner's external strict probe in CI | Exercises a live provider and browser | Depends on credentials, availability, and owner paths | Rejected for automated validation |
| Add another Downloader API or UI control | Can make linkage visually prominent | Duplicates an existing authenticated read model and complicates the page | Rejected |
| Assert only persisted candidate context | Fast and direct | Does not prove the real Downloader projection or operator scope | Rejected |
| Extend the isolated provider pipeline through the packaged Downloader module | Deterministic, uses the production queue projection, tests both operator scopes, and requires no secrets | Validates the provider contract fixture rather than every live slskd implementation | Chosen |

## Design

1. Use the existing shared-recovery fixture: one global request has two
   operator-owned wanted releases, a failed primary candidate, and one active
   fallback candidate.
2. Construct the production `createDownloaderModule` inside the packaged app
   container with the same slskd service used for real dispatch and transfer
   work.
3. Build the Downloader read model once per operator, locate the fallback
   candidate's transfer, and require exactly one linked transfer for each
   operator.
4. Require that the transfer's `musicQueueRelease.wantedReleaseId` is the
   current operator's own wanted release.
5. Reject a sibling wanted-release ID, either operator ID, or the synthetic
   private-policy marker anywhere in the returned linkage.
6. Return aggregate counts and boolean redaction facts only. The outer script
   must not print provider, user, or release IDs in successful evidence.

The focused helper is a small ESM module under `testing/docker/`; it has its
own unit tests and is mounted read-only into the isolated app container. The
large pipeline verifier only arranges the production scenario and reports
aggregate evidence.

## Recommendation Stack

1. Run `npm run validate:docker-controlled-provider-pipeline -- --no-cache`
   before relying on a change that affects Music Queue, transfer linkage, or
   Downloader projections.
2. Run the owner-configured strict provider probe from
   [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md) when validating a
   real slskd deployment; it remains the browser-level complement.
3. Keep the generic non-strict provider probe for setup diagnostics only.
4. Do not add a combined queue/downloader screen or redundant action labels
   until observed operator feedback shows the existing handoff is inadequate.

## Security Boundary

- The validation creates a temporary Compose project, internal provider, and
  random process-local API key; it never reads an owner's provider credentials
  or library directories.
- The provider has no host-published port, is read-only apart from the
  temporary downloads mount, drops capabilities, and uses
  `no-new-privileges`.
- The assertion exercises object-scoped linkage for both operators and fails
  if any sibling release identity, operator ID, or private policy marker reaches
  the Downloader projection.

## Validation Repair

The first packaged run found that the production execution worker's durable
`awaiting_confirmation` handoff checkpoint was absent from the
`import_execution_run_items` database check constraint. The checkpoint is what
prevents a retry from sending an unconfirmed slskd enqueue request twice.

The forward-only migration
`20260825_220000_import_execution_handoff_confirmation_status.sql` admits that
already-supported state without changing the worker's behaviour. The schema
snapshot now includes the same vocabulary. This is a data-integrity repair,
not a relaxation of the handoff guarantee.

## Next Item

The automated proof now passes. The next high-value work is a concise
operator-facing readiness result for the owner-configured strict probe:
distinguish absent provider configuration, absent accepted transfer, path
mapping mismatch, and missing Music Queue linkage without exposing secrets.
