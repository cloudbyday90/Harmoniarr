# Stable provider wire-version outcome

Date: 2026-10-20. Implements the [design](SLSKD_WIRE_VERSION_DESIGN.md) and
[official recommendations](SLSKD_WIRE_VERSION_RESEARCH_2026_10.md).

## Implemented change

The existing ESM protocol policy gains one exact batch entry: 0.26.0.0. The
reported version remains unchanged in captured bindings and durable attempts.
Existing three-component forms remain valid. Unreviewed revisions, canaries,
metadata, malformed/coerced inputs and the 0.26.1 candidate remain refused.
No route, schema, dependency, retry policy or service ownership changes.

Two of four new policy cases fail before the fix, reproducing the missing
stable admission. The corrected focused group passes 100 tests across protocol,
dispatch, attempts, batch receipts, handoff reconciliation and snapshots. This
includes rejection when either supported batch spelling replaces an already
prepared binding, before beforeSend or POST, plus configuration/credential
refusal and original lost-response uncertainty. Controlled-client test names
now distinguish their injected transport from a real provider.

## Durable and broad validation

The owning PostgreSQL/controlled-HTTP file passes all four cases, zero skips or
cancellations, in 10.9 seconds. It stores the exact 0.26.0.0 binding, confirms
exact caller UUID/receipts, observes completed removed transfers and advances
only the guarded phase owner. Lost responses recover without another POST;
409/local-only/partial/stale-endpoint evidence remains unresolved. Required
audit failure rolls back receipt links, candidate phase and checkpoint, and
source drift cannot confirm. This fixture is not native slskd acceptance.

Canonical Node 24.22.0/npm 12.0.2 validate:fast passes 10,557 tests: server
5,472, client 4,388 and scripts 697, with lint, policy checks and both builds.
That invocation takes 100.0 seconds. Focused counts overlap this fast inventory;
the separate PostgreSQL cases are not part of it. No complete database/browser
inventory or before/after performance improvement is claimed.

Final source is 3,050 files with SHA-256
1ccd6d4c34053665cc985857ae369281a6a500009b73ca0ccd80c3507b489795.
Private logs, original/candidate bytes and native collections remain under
.tmp/slskd-wire-2026-10-20, outside the commit.

## Native packaged provider

The original app image 9f193ccd reproduces slskd_download_version_unsupported
against actual stable wire 0.26.0.0. That assertion fails as expected, and its
collection is retained. The corrected no-cache Linux/amd64 image is
sha256:05a1b489efcc76be8b474ac0c4dab15e721875528f39decf72ca0d0a72648013.
Both observations use provider identity
sha256:ecd4026d4f8fb504e2cc55323efa2c1f5b56d20d3686b018249cc36b48ea17a6.

The corrected packaged service prepares batch dispatch and retains the raw
version. Native invalid authentication returns 401; an empty-file batch returns
400. One actual well-formed batch request reaches beforeSend once, then returns
500/slskd_unavailable while isolated from Soulseek. Its exact batch lookup returns
404. The attempt remains unchanged, without receipts, legacy fallback or another
POST; an empty result evaluates as unknown rather than confirmed or rejected.

The final packaged inventory changes only the version policy, matching frozen
source bytes. All other server/client/shared files, app package paths/versions
and OS package entries match the prior image. The subsequent preserved-state
[walkthrough rebuild](LOCAL_DOCKER_WIRE_VERSION_OUTCOME.md) passes healthy startup,
existing-admin bootstrap and readiness-only validation.

Both native projects pass config permissions, app/provider health, authenticated
private API and egress-isolation checks. The private overlay publishes the app
only on loopback and removes the unused provider listener publication. Candidate
app and provider identities are inspected. Containers, networks and volumes are
verified removed before temporary bind data is deleted; repository provider
configuration is restored. This native refusal does not prove successful batch
admission, peer transfer or completed receipt delivery.

## Random PR

The separate [PR 48 evaluation](OPEN_PR_48_WIRE_VERSION_EVALUATION.md) retains
the installed TypeScript 7 initialization failure and passing restored
TypeScript 6/Vue bridge. The original package pair is restored byte-for-byte;
no candidate tooling dependency, PR merge, release or Git tag remains.

## Next qualification

Add a wholly isolated provider/peer fixture that can produce native successful
batch admission and exact receipt reads. Keep public accounts/network traffic
out of that fixture. Then review 0.26.1 source, cancellation/retry changes and
native receipts before adding its exact wire form or adopting PR 51. The current
fix resolves baseline preparation; it does not qualify future providers. Recheck
the announced October 21 Node security patch when actually published.
