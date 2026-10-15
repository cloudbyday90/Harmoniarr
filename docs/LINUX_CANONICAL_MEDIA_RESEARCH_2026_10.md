# Linux canonical media official research

Consulted 2026-10-15 through MCP search/opening and GitHub repository metadata.
The sources below were discovered by those services. Host Node is 24.18.1; the
Linux fixture uses 24.21.0. Engine is Linux 29.8.2/API 1.56. Versioned Node 24.8
documentation describes the TestsStream summary contract used here; current
native source inspection additionally confirmed inherited execution arguments
are appended rather than replaced by the run option.

| Primary source and status | Applicable practice | Implementation/evidence |
| --- | --- | --- |
| [Node test runner 24.8](https://r2.nodejs.org/dist/v24.8.0/docs/api/test.html), vendor documentation | Use TestsStream events; distinguish per-file and cumulative summaries, including skips/cancellations | One literal file, exact successful cumulative summary and complete media records |
| [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/), vendor guidance | Sources belong to the daemon host, not an arbitrary client/container path | Desktop replay mounts the inspected owned volume path at the identical Linux path |
| [Docker volumes](https://docs.docker.com/engine/storage/volumes/), vendor guidance | Docker manages named storage independently of container lifetime | Exact labeled volume identity, stopped-runner checks and retained failed workspaces |
| [Docker Engine security](https://docs.docker.com/engine/security/), vendor security guidance | Daemon control belongs only to trusted users | Socket confined to trusted validation runner; canonical media owners receive no socket/network |
| [Testcontainers configuration](https://node.testcontainers.org/configuration/), maintainer documentation | Host override controls access to published sibling ports; reaper behavior is separately configurable | Desktop host gateway override; normal reaper remains enabled |
| [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use?ref=marcinhoppe.com), vendor security guidance | Pin upstream actions to complete commit SHAs and constrain token access | Reused reviewed checkout/setup pins, read-only permissions, no persisted checkout credentials; manual-only job |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), Working Draft dated 2026-09-01 | Use monotonic elapsed durations | Lane measures returned completion; does not infer CI speed or a standards certification |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Minimize output and preserve primary behavior through diagnostic failure | Fixed public aggregate fields, bounded private input consumption, original Error/null and stream drainage |

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Strict native Linux lane plus manual CI workflow | Reuses actual canonical assertions; rejects green skips and incomplete ownership evidence | Requires reviewed local Engine and image; hosted runner capability may fail admission | Implement |
| Trusted Desktop Linux replay with same-path owned volume | Exercises real Linux paths, permissions, Unix reader and lifecycle locally | Privileged socket access and network connectivity; explicit volume/runner ownership required | Use for local proof, distinguish from hosted Ubuntu |
| Generic runner bind mounted at `/fixtures` | Familiar layout | Does not establish that sibling bind sources exist at the same daemon path | Reject |
| Automatically add the lane to every push | Broader routine coverage | Adds dependency/image/container cost before rollout decision | Keep manual-only |
| Automatically downgrade API/version, remove inspections or force-exit | May hide failed prerequisites or shorten output | Changes proof or can abandon resources | Reject |

Recommended stack: pure admission/evidence policy → read-only local daemon/image
preflight → literal native TestsStream lane → existing canonical app/worker and
workspace owners → fixed aggregate result → explicitly selected CI job. These
are project decisions inferred from the sources and native evidence, not
standards mandates. No browser behavior changed, so no new WCAG/assistive-
technology conformance is claimed.
