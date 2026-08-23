# Single-Node Deployment Topology Gate

Status: Implemented and validated
Date: 2026-08-22
Owner: Deployment architecture + metadata platform

## Finding

The supported Compose deployment runs one `harmoniarr` container with embedded
PostgreSQL and host-backed writable application, download, library, staging,
and transcode paths. It is not a horizontally scalable application topology:
separate containers would not share a database or durable application state,
and concurrently using the same host paths would be unsafe.

This answers the cache architecture question for the checked-in deployment.
The existing metadata-module-scoped MusicBrainz client queue and bounded
related-artists workflow are the correct egress controls for one process. A
distributed rate limiter is not safe to introduce until the application and
database topology are deliberately separated and multiple application
replicas are known to share one outbound IP address.

MusicBrainz measures request rate by source IP and currently rejects all
requests from an IP when its average rate is too high; its public API guidance
sets the ordinary application limit at one request per second. A per-process
queue cannot coordinate replicas, but a central limiter would be needless
complexity in the supported single-node deployment.

## Official Source Review

Sources were discovered and reviewed on 2026-08-22:

- [MusicBrainz API rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
  documents source-IP enforcement and the average one-request-per-second
  expectation.
- [Docker Compose Deploy Specification](https://docs.docker.com/reference/compose-file/deploy/)
  defines `mode: replicated` and `replicas` as the explicit service scale
  contract.
- [Docker Compose production guidance](https://docs.docker.com/compose/how-tos/production/)
  distinguishes its straightforward single-server deployment from later
  cluster scale-out.
- [PostgreSQL advisory locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  explains that advisory locks are application-defined and transaction locks
  release at transaction end. A network request must not hold such a database
  transaction open, so this is not a substitute for a future purpose-built
  distributed rate limiter.
- [GitHub Actions security hardening](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats)
  recommends pinning third-party Actions to full commit SHAs.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Add a distributed limiter now | Coordinates a future multi-replica egress identity | Requires new durable coordination, failure policy, monitoring, and a supported shared database before there is a replica topology | Reject |
| Rely on the host-port collision or embedded PostgreSQL startup failure | No source changes | Failure is incidental, late, and does not express the supported deployment contract | Reject |
| Documentation only | Explains the current boundary | Does not prevent a later Compose edit from silently declaring scale-out | Reject |
| Explicit one-replica Compose contract with a checked ESM policy | Makes the supported topology reviewable and detects configuration drift before release | A future horizontal deployment must intentionally replace the contract | Implemented |
| Use `container_name` to prohibit scaling | Makes a Compose scale command fail | Reduces Compose composability and is not a durable application-topology design | Reject |

## Final Recommendation Stack

1. Keep one `harmoniarr` replica in the supported Compose and walkthrough
   configurations while embedded PostgreSQL and host-backed mutable state are
   part of the container.
2. Retain the metadata-module-scoped MusicBrainz queue, its meaningful
   User-Agent, HTTPS and outbound-host policy, minimum interval, retries, and
   bounded interactive response budget.
3. Fail CI when a supported Compose definition omits or changes
   `deploy.mode: replicated` with `deploy.replicas: 1`.
4. Do not add a PostgreSQL advisory lock or a distributed limiter to the
   current topology. Neither fixes the fact that independent embedded
   databases would be unable to coordinate.
5. Before any scale-out effort, move to an approved shared PostgreSQL topology,
   introduce an opaque instance identity and fleet telemetry, then test a
   central egress limiter under concurrent replicas sharing an outbound IP.

## Security Controls

- The topology check is an offline build policy. It adds no HTTP route,
  administrative control, database table, credential, instance identifier, or
  sensitive diagnostic output.
- The check holds the deployed configuration to its explicit one-replica
  contract instead of relying on an incidental runtime collision.
- The default metadata egress limits remain server-owned; no browser request
  can alter their interval, deadline, or fallback fan-out.
- A future distributed design must coordinate only opaque limiter state and
  must not use provider payloads, artist identifiers, cookies, credentials, or
  user data as rate-limiter keys or diagnostics.

## Open Pull Request Review

Dependabot PR #23 proposed moving `docker/metadata-action` from v6.0.0 to
v6.1.0. It was inspected locally but not merged. The official release page now
lists signed v6.2.0 as the latest stable release, so this implementation
applies the PR's intent directly at the verified v6.2.0 full commit SHA rather
than accepting the stale v6.1.0 pin.

## Implementation Outcome

- `compose.yaml` and `compose.walkthrough.yaml` explicitly declare one
  replicated `harmoniarr` service.
- `compose-single-node-topology-policy.js` is a focused ESM policy module that
  verifies the declaration in both supported Compose files.
- `check-compose-single-node-topology.js` provides a small CLI adapter, and
  the policy runs from both repository validation and the security gate.
- The release workflow uses the current immutable full SHA for
  `docker/metadata-action` v6.2.0.

## Validation

- `npm run validate` passed. This includes copyright, ESM, image-tag,
  migration, schema, lint, test-hygiene, server, client, script, and 31
  real-PostgreSQL integration tests, followed by the production client and
  server builds.
- `npm run check:compose-topology` passed for both supported Compose files.
- `docker compose -f compose.walkthrough.yaml config --quiet` passed.
- The documented no-cache walkthrough rebuild completed successfully:
  `docker compose -f compose.walkthrough.yaml build --no-cache harmoniarr`,
  `up -d --wait --no-build harmoniarr`, and the disposable bootstrap helper.
  Docker reported the single Harmoniarr container healthy.

## Next Item

Do not implement a centralized metadata limiter for the current topology.
The next conditional architecture item is a scale-out design only after a
deployment requirement establishes separate shared PostgreSQL, two or more
application replicas, and a shared egress identity. Until then, collect
rate-respectful real-provider paired samples and tune only a measured
single-process cache or provider failure.
