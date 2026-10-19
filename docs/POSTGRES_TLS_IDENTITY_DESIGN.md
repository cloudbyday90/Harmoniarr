# Native PostgreSQL TLS identity design

Date: 2026-10-19. This closes the local TLS evidence gap identified in the
[driver outcome](POSTGRES_DRIVER_8231_OUTCOME.md). It adds disposable native
fixtures and contract tests; it does not change production database policy.

Use the existing Testcontainers PostgreSQL withSSL API with checked-in public
test keys and certificates. That API copies files, applies postgres ownership and
0600 permissions, and enables SSL. Reuse the existing PostgreSQL runtime for
admission and server retirement. Bootstrap administration may use plaintext;
the test checkout explicitly requires verified TLS. No public or production CA
trust store is modified. No host OpenSSL command is required to run the tests.

Certificates are fixture data: a private test CA signs a leaf with localhost DNS
and 127.0.0.1 IP SANs, and a second leaf with deliberately wrong SANs. The wrong
leaf has a localhost common name to prevent accidental CN-only acceptance. A
separate untrusted CA distinguishes trust-chain failure from name mismatch.
CA signing keys are not committed. Leaf keys are public test material and must
never be used outside disposable fixtures. Unit checks verify signatures, key
pairing, SAN intent and validity; native TLS is the actual acceptance boundary.

Each attempt uses a fresh pg.Pool and one original native PgConnection instance,
with the reviewed connection observer attached before checkout. This supplied
native connection lets the fixture await the actual raw and replacement TLS
socket close events without replacing the verifier or driver methods. Keep the
existing two-client/10-second fixture limits; admit only one cold checkout to
that explicitly supplied connection. Promise and callback paths are both covered.

Node's default verifier, explicit rejectUnauthorized=true and a fixture-local CA
must remain active. Do not inject a successful checkServerIdentity result or
override servername. Connect to actual loopback IP and localhost DNS identities.
Require a real query and pg_stat_ssl proof for matching identities. Mismatches
must return the actual ERR_TLS_CERT_ALTNAME_INVALID failure before authentication
or readiness; an untrusted chain must also fail before authentication. Installed
pg queues its local startup write synchronously on sslconnect, before TLS
verification; do not mistake that buffered local dispatch for authenticated wire
delivery or require its absence on certificate rejection.

Capture the owned observer at sslconnect, secureConnect and after checkout.
Stream creation is not handshake success. Handshake completion is not database
readiness, and configuration targetMatch is not authenticated server identity.
The native successful socket must separately report authorized=true. Keep
process-relative monotonic durations and existing minimized diagnostic records.

Drain the admitted checkout, release the client, await pool shutdown and both
socket close acknowledgements, finish/restore only owned diagnostic hooks, then
retire the server before removing temporary certificate files. Cancellation must
request socket destruction and still await actual close. Never replace an earlier
Error/null with cleanup failure. If runtime creation or retirement fails, retain
the certificate workspace because server retirement is uncertain. Active native operations remain registered past
a test timeout so suite teardown cannot discard resources early.

The random PR evaluation and final scope belong in separate outcome documents.
Validation proceeds from focused certificate/lifetime/observer tests to one
serial group of affected native files, then validate:fast on stable source.
Record source/lock identity, failed collections, selected versus complete
coverage and remaining platform limits. No branch, release, PR merge or default
fixture scheduling change is part of this work.

Fixture maintenance: certificates were authored with OpenSSL 3.5.7, EC P-256,
SHA-256, serverAuth usage and ten-year validity from October 19, 2026. Regenerate
the CA and both leaves together before expiry, preserve the intended SAN/CN
negative, update the separate untrusted CA and rerun unit and native controls.
Commit only the public CA certificates and public test leaf keys, never CA
signing keys. JSON fixture bytes participate in the ordinary source fingerprint.
