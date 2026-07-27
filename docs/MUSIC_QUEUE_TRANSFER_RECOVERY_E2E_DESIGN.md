# Music Queue Transfer Recovery E2E Design

## Status

Implemented on 2026-07-27. This document defines end-to-end proof for the
automatic Music Queue behavior after a provider reports a terminal transfer
failure.

## Problem

The recovery service had focused tests for choosing a successor match, but no
acceptance test proved that a real provider transfer failure reached the
database, left the failed match terminal, scheduled the follow-up download,
and completed a fallback add to the library. A recovery-only unit test cannot
detect PostgreSQL query typing errors or provider-contract drift.

## Research

- [Docker Compose](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-docker-compose/)
  defines the service lifecycle boundary used for this isolated provider and
  Harmoniarr stack.
- [Docker volumes](https://docs.docker.com/engine/storage/volumes/) explains
  that volumes outlive containers unless explicitly removed. The validator uses
  a unique workspace and `docker compose down --volumes --remove-orphans`.
- [Playwright best practices](https://playwright.dev/docs/best-practices)
  recommends independent test state and explicit setup/teardown. The same
  isolation rule applies to this service-level acceptance test.
- [slskd configuration](https://github.com/slskd/slskd/blob/master/docs/config.md)
  is the authoritative external-provider reference. The fixture implements
  only the Harmoniarr request contract rather than treating live peer behavior
  as deterministic test input.
- [FFmpeg filters](https://www.ffmpeg.org/ffmpeg-filters.html) documents the
  `aevalsrc` synthetic audio source used to produce cleanup-safe FLAC evidence.

## Options

### Recovery-service unit tests only

Pros: fast and precise policy coverage.

Cons: cannot verify provider transfer states, execution reconciliation, actual
PostgreSQL queries, or worker handoff.

### Live Soulseek failure test

Pros: uses real peers.

Cons: nondeterministic availability, uncertain transfer behavior, retained
content, and no reliable cleanup. It is unsuitable for automated acceptance.

### Controlled provider failure fixture

Pros: real Harmoniarr service, database, worker, reconciliation, inspection,
and safe-add paths with deterministic failure and controlled cleanup.

Cons: validates Harmoniarr's provider contract rather than every live provider
implementation detail.

## Decision

Use the controlled provider fixture as the acceptance boundary. One synthetic
release returns two quality-eligible matches. The higher-ranked primary is
selected and reports a terminal transfer failure. Harmoniarr must:

1. mark that primary match `failed`;
2. select only the next eligible match in the same release/search scope;
3. create a bounded follow-up download run;
4. inspect and safely add the fallback file; and
5. do all of this without a normal Activity or candidate-review action.

For a transfer rejection, the existing bounded same-match retry remains the
right behavior because the provider may accept that match shortly afterward.
A terminal failed transfer does not retry the same match before fallback.

## Security And Data Integrity

- Test media is generated with FFmpeg in an ephemeral shared mount; it is not
  downloaded from peers and is removed with the Compose project and workspace.
- The provider API key is random per process, kept out of logs, and scoped to
  the isolated internal service.
- The fallback query stays parameterized. Optional JSON audit values are cast
  to `text` inside `jsonb_build_object`, preventing PostgreSQL's ambiguous
  nullable-parameter error without concatenating user-controlled SQL.
- Recovery remains scoped by search or metadata release and excludes failed,
  rejected, exhausted, and below-profile matches.

## Recommendation Stack

1. Keep focused recovery unit tests for transition policy and quality gating.
2. Run `npm run validate:docker-controlled-provider-pipeline -- --no-cache`
   before release-sensitive changes to provider, recovery, execution, or
   import code.
3. Keep live provider tests manual and observational. Never make automated
   tests depend on live peer content or operator-owned folders.
4. Surface the user-facing release status in Music Queue; retain match IDs,
   execution details, and raw provider state behind Advanced diagnostics.

## Outcome

The validator proves two safe library additions: the normal primary case and
the fallback after a controlled terminal failure. It also verifies 15 synthetic
fixture inputs yield 15 ingested matches, including the two-match recovery
release and a bounded no-response diagnostic.

The acceptance run found and corrected a real PostgreSQL `42P18` error in
recovery metadata persistence. This is now covered by both a repository query
contract test and the full Docker execution path.

## Next Step

The next high-value slice is browser acceptance for the normal Music Queue
release row through a failed transfer and automatic fallback. It should show
`Trying another match` and then `Downloading`, without surfacing candidate
controls or requiring the user to visit Activity.
