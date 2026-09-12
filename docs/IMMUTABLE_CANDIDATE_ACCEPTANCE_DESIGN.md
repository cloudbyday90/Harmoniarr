# Immutable candidate acceptance design

Design date: 2026-09-11. Scope: the first release follow-up from [Missing Music pagination](MUSIC_QUEUE_PAGINATION_OUTCOME.md).

September 12 follow-up: the [published trust design](PUBLISHED_CANDIDATE_TRUST_DESIGN.md) adds provenance verification before runtime execution. The harness now also permits unchanged-schema patch upgrades while retaining ledger and request-continuity proof. The historical local upgrade evidence remains separate from published trust.

## Purpose and decision

Harmoniarr is a Docker-first, Soulseek-native music library manager with a Node 24 native ESM application, Vue client, and embedded PostgreSQL 18. Source validation cannot prove that the packaged application starts, migrates retained data, and includes its recovery binaries. Test one immutable candidate through fresh installation, restart, and upgrade from a distinct immutable baseline.

Add a strict candidate acceptance command around the existing smoke scenarios. Keep image identity, isolated fixture construction, packaged schema checks, orchestration, and CLI/evidence writing in small ESM modules. The existing smoke runner receives narrow verification hooks rather than another embedded policy subsystem.

## Research and alternatives

Official sources were discovered through web search and GitHub MCP on September 11, 2026. These are current observations, not claims about later September releases.

| Choice | Benefit | Cost / limit | Decision |
| --- | --- | --- | --- |
| Tag-only smoke | Convenient iteration | A tag can move; input text does not prove container identity | Keep legacy development tooling; reject tags in strict acceptance |
| Registry digest | Stable registry artifact reference | Registry access and separate provenance verification are required | Preferred release input |
| Full local image ID | Tests a locally built immutable artifact before publication | Does not prove registry publication or accepted-release lineage | Explicit local mode, separately labelled evidence |
| Rebuild separately for each scenario | Simple standalone commands | Scenarios may test different artifacts | Resolve once and use the same image ID throughout |
| Reuse operator Compose environment | Less fixture setup | Local `.env`, provider settings, ports, and credentials can contaminate the rehearsal | Generated isolated Compose and credentials |
| Settings-only upgrade probe | Fast compatibility check | Does not establish schema ledger or durable state continuity | Retain it and add packaged schema/continuity checks |

Docker documents tag mutability and recommends digest pinning with deliberate updates; its pull reference distinguishes content-addressed local image IDs from registry digest references. This supports distinct local and registry evidence rather than calling either a release automatically. [Build guidance](https://docs.docker.com/build/building/best-practices/), [image pull semantics](https://docs.docker.com/reference/cli/docker/image/pull/).

Docker's containerd store can expose three different identifiers: the input image index, selected platform manifest, and container configuration. Record all three and compare the running platform descriptor with the inspected platform manifest; classic stores can compare configuration identities directly. Platform inspection requires Engine API 1.49 or newer. [Image inspection](https://docs.docker.com/reference/cli/docker/image/inspect/), [API history](https://docs.docker.com/reference/api/engine/version-history/).

Published origin remains a separate gate: verify repository, signing workflow, and source commit with attestations. Build arguments may appear in provenance, so credentials belong in secret mounts. Compose files are executable host-access configuration; the fixture renders the checked-in baseline without operator interpolation and explicitly replaces its mounts, networking, credentials, and image inputs. [Docker provenance](https://docs.docker.com/build/metadata/attestations/slsa-provenance/), [GitHub attestation verification](https://cli.github.com/manual/gh_attestation_verify), [Compose trust model](https://docs.docker.com/compose/trust-model/).

PostgreSQL minor updates permit restarting the same data directory, while major upgrades require a separate upgrade or dump/reload process. This acceptance path stays within PostgreSQL 18 and does not imply cross-major compatibility. [Versioning policy](https://www.postgresql.org/support/versioning/), [pg_upgrade](https://www.postgresql.org/docs/18/pgupgrade.html).

## Safety and evidence contract

- Require full SHA-256 local IDs or registry digest references; reject mutable tags, identical baseline/candidate artifacts, and image revision mismatches before startup.
- Inspect the running container and bind its actual image identity to the resolved input. A revision label is an asserted build label, not a signature or attestation.
- Use only a local Docker engine, generated project names, disposable directories, generated credentials, loopback HTTP publishing, a read-only root filesystem, dropped capabilities, and no privilege escalation.
- Keep operator `.env`, saved credentials, existing deployments, production databases, and media out of the fixture. No provider acquisition is configured.
- Run checks inside the packaged application: migration verification, retained migration ledger, pagination indexes, PostgreSQL recovery binaries, and application CLI availability.
- Preserve cleanup failures as failures. Persist a pass only after every scenario and owned-resource cleanup succeeds.
- Evidence contains fixed summaries, image identifiers, revision assertions, and verification results; exclude credentials, raw logs, database content, and host paths. Reserve a new output file so a failed run cannot leave stale passed evidence.

## W3C boundary

This is operator CLI/release tooling and adds no browser interaction. Preserve the existing application HTTP session and CSRF flows exercised by the smoke checks. Native controls, focus behavior, and status announcements remain covered by the pagination browser acceptance; packaging proof does not replace accessibility evidence. W3C's requirements support meaningful focus order and programmatically exposed status updates without forced focus. [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

## Acceptance and outcome

Unit tests must reject malformed or mutable image references, unexpected container images, revision mismatches, failed verification, and failed cleanup. Real Docker runs must use one candidate image for fresh install and upgrade, with the baseline built from a known earlier source revision when no accepted published release is available. Report that fallback explicitly.

The separate [outcome document](IMMUTABLE_CANDIDATE_ACCEPTANCE_OUTCOME.md) records actual images, checks, limitations, open PR disposition, and the next recommendation stack. Release provenance, ARM64 execution, live provider access, and operator recovery cutover remain distinct evidence requirements.
