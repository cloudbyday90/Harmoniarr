# Astra persistent folder retention review

GPT-6 Astra performed read-only planning, upstream PR and implementation reviews
on November 14, 2026. It made no edits, external writes or validation runs.
See the [design](FOLDER_RETENTION_DESIGN.md) and [outcome](FOLDER_RETENTION_OUTCOME.md).

## Findings and dispositions

| Finding | Implemented disposition |
| --- | --- |
| Existing repeated workloads construct fresh services | One stable service/adapter per persistent worker, tested across several cycles. |
| Existing memory helper forces GC while retaining returned results | Separate observer; wave scope returns only a compact summary before idle. Natural GC is primary. |
| One resumed request can hide loss of other admissions | Recover a full four-request wave and again refuse a fifth without I/O every cycle. |
| Rejected close cannot establish retirement | Count only successful native close settlement; fail and seal qualification after uncertainty. |
| Natural mode can observe its own outstanding filesystem request | Yield after auxiliary filesystem reads in both modes, with ordering tests and corrected native reruns. |
| Late failure/timeout could discard completed checkpoints | Bound and acknowledge chronological JSONL progress; live controller saves complete partial records without replacing original Error/null. |
| Summary needs independent completeness/numeric checks | Validate sequence, owner, consistent digest, elapsed/cgroup/memory values, descriptor count, counts and output bounds. |
| Old 120-second outer deadline is too short for the whole schedule | Fixed 600-second worker containment; retain the production five-second cooperative checkpoint. |

Astra accepted three warm-up plus twelve measured cycles as bounded
characterization, not a soak or plateau proof. It emphasized that memory includes
bounded harness rows; stdout completion is not durable controller-crash recovery;
resource types are supplementary; and only corrected-source native reruns qualify
the final implementation. Its final review reported no further blocking findings.

## Random PR review

Astra reviewed exact upstream PR 66 metadata, source and toolkit changes. Nine
workflow references keep six GHCR and three Docker Hub password logins. The
published bundle changes packaging while retaining Node 24; scoped configuration
gains path-containment checks, and supplied passwords bypass the new OIDC path.

It recommended testing the actual published main/post bundle with a fake Docker
executable, synthetic stdin credentials, isolated state/config, no socket and no
network. It also identified the pre-existing empty-stderr/nonzero-login success
behavior and warning-only logout failures. The local proof characterizes these
limits; it does not establish real registry authentication, hosted secret masking,
credential-store cleanup or successful release publication.
