# Native PostgreSQL TLS identity outcome

Date: 2026-10-19. The [design](POSTGRES_TLS_IDENTITY_DESIGN.md) and
[official research/tradeoffs](POSTGRES_TLS_IDENTITY_RESEARCH_2026_10.md) led to
five real PostgreSQL identity controls using default Node certificate verification.
All authored JavaScript is ESM. Work stays on main with no release.

## Delivered boundaries

postgres-tls-fixture.js reuses the existing PostgreSQL runtime and Testcontainers
12.1.0 withSSL setup. It writes public test leaf material into an owned temporary
directory and removes it only after acknowledged runtime retirement. Uncertain
runtime creation or cleanup retains that directory. The separate JSON data file
contains public test leaf keys, CA certificates and deliberate identity/trust
negatives; CA signing keys are not committed or installed in a system trust store.

pg-tls-attempt.js owns one cold checkout through an original native PgConnection,
existing connection observer and a normal pg.Pool. It retains fixture pool limits,
explicit rejectUnauthorized=true, a fixture-local CA and Node's default name
verifier. No custom checkServerIdentity, servername substitution or TLS bypass is
used. It awaits pool retirement and actual raw/replacement TLS socket close,
finishes/restores only owned hooks and then lets the outer runtime stop the server.

Native controls establish:

- Matching 127.0.0.1 IP and localhost DNS SAN identities complete one authorized
  handshake and real queries. pg_stat_ssl reports SSL with TLS 1.2 or 1.3.
- Wrong IP/DNS SANs return the actual ERR_TLS_CERT_ALTNAME_INVALID failure.
  The wrong leaf's localhost CN does not rescue its mismatched SAN.
- A separate unknown CA fails before authentication, independently of name
  matching. Failed attempts have no secureConnect, authentication or readiness
  milestones, and their sockets close before the helper returns.
- IP uses promise checkout and DNS uses native callback checkout. All five cases
  restore the observed Client/startup surfaces and verify closed socket owners.

Installed pg queues startup synchronously at sslconnect, before secureConnect.
Both successful and rejected handshakes therefore retain a local buffered startup
dispatch. The tests preserve this actual ordering: local dispatch is neither
certificate acceptance nor authenticated wire delivery. They check authorized,
handshake and real database readiness separately. Configuration targetMatch also
remains distinct from server identity verification. No diagnostic schema or
production TLS policy changed.

## Validation and retained evidence

Thirty focused certificate/lifetime/observer cases and 47 existing parser/
artwork/snapshot cases passed. Controlled lifetime tests hold server retirement,
preserve original Error/null, retain uncertain files and refuse unknown profiles
or pre-cancelled admission. Those controls are distinct from native running-
handshake cancellation, which was not newly tested here.

The first selected native collection passed all 19 cases. Review then tightened
certificate-workspace retention after uncertain retirement and added its focused
control. A fresh four-file collection passed on the corrected final source:

| Native file | Cases | Local seconds |
| --- | ---: | ---: |
| postgres-tls-identity.test.js | 5 | 22.298 |
| pg-driver-contract.test.js | 2 | 5.136 |
| postgres-startup-server.test.js | 4 | 19.505 |
| library-tag-snapshot.test.js | 8 | 36.917 |

All 19 final native cases have zero failures, cancellations, skips or todos.
The existing preflight admitted pinned PostgreSQL 18.3, media and Linux-reader
identities before serial file execution. Host Node is 24.18.1; Docker Engine is
29.8.2/API 1.56. The reader's Node 24.21.0/Docker CLI 29.9.0 are separate versions.
Fast and native work overlapped under current host load; elapsed values are
observations, not a speedup comparison or historical-failure diagnosis.

validate:fast passed 10,514 cases: 5,459 server, 4,384 client and 671 scripts,
with zero failures/cancellations/skips/todos. Both production builds and static,
ESM, lint and hygiene checks passed in 129.658 seconds. The existing 225 Vue
warnings and one TestsStream end-listener warning per selected native process
remain unresolved. No listener limit or warning suppression changed.

Final native source identity is 3,033 files, SHA-256
1d227416ef50be626d2e8485f268a03c1f081d81dc070c6c525bf249ffdb8d3d.
The before/after fingerprint includes the certificate JSON and dependency lock.
Staging is verified against those tested bytes. Raw logs, both native collections,
candidate package backups, package integrity/file checks and supplementary probe
failures remain ignored under .tmp/postgres-tls-2026-10-19/.

Certificate authoring initially found no openssl executable in the PostgreSQL
image, then found an invalid inherited host OpenSSL configuration. Authoring
succeeded using local OpenSSL 3.5.7 with an explicit private configuration. These
were setup probes; the committed tests require no OpenSSL executable. The first
supplementary parser probe used a wrong expected error code; its corrected typed
error check passes. See the separate [PR 44 outcome](OPEN_PR_44_LOCAL_EVALUATION_OUTCOME.md).

## Recommendation and limits

Retain the existing Node 24 modular ESM platform, reviewed pg/pg-pool/protocol
tuple, verified fixture-local TLS controls and the exact locally qualified
music-metadata 12.2.1 subtree. Keep TypeScript 6 and the current production TLS
configuration. Benefits are real acceptance/refusal and retirement evidence with
no new runtime tool dependency; costs are certificate validity maintenance,
additional Docker scenarios and the remaining coverage below. The updated testing
and web-standards AI skills preserve these distinctions and uncertainty rules.

Inventory is now 130 integration files/intended 568 native cases. This round ran
four selected files/19 cases; 126 other paths were not freshly rerun. It is not a
complete integration gate, every media-format qualification, hosted-Ubuntu proof,
browser secure-context/accessibility certification or a deployment-image test.
New TLS coverage is local IPv4/localhost with PostgreSQL SSL negotiation. IPv6,
direct TLS/ALPN, revocation, expired certificates and active native handshake
cancellation remain separate unperformed cases. Bootstrap administration can use
plaintext; these tests do not enforce TLS for every production connection.

Next, qualify the remaining Express/Vue/router updates in
[PR 49](https://github.com/cloudbyday90/Harmoniarr/pull/49) on actual request/session/
CSRF and nested asynchronous navigation behavior. TestsStream listener ownership
is an independent follow-up. No PR merge, closure, rebase, tag, release or
deployment-image rebuild was performed by this work.
