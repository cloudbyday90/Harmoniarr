# Public provider HTTPS fixture certificates

These certificates and leaf keys are intentionally public test material. Never
install this CA in an operating-system or application trust store, expose the
fixture listeners, or use these keys for real data. The CA signing key is not
committed. Certificates expire in October 2036; regenerate the two leaf profiles
and CA together before expiry.

`matched` contains the five fixed collection-provider DNS names, Last.fm's
ws.audioscrobbler.com hostname and IPv4 127.0.0.1.
`mismatched` contains only wrong.example.invalid and IPv4 127.0.0.2. Both share
the fixture CA so identity refusal is independent of chain refusal.

`testing/server/provider-https-fixture.js` binds ephemeral loopback listeners and
allows only explicit CONNECT authorities. It always connects to its own local
TLS port. The child receives a minimal environment and trusts the fixture CA
only at startup; the untrusted-chain child receives no additional CA. Default
certificate verification remains enabled. These tests need no provider account,
external network, Docker, OpenSSL executable or additional npm dependency.
