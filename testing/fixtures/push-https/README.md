# Local HTTPS push fixture

The certificate and private key in this directory are synthetic, public test data for localhost, 127.0.0.1, and push-fixture.example.com. They are not deployment credentials. The self-signed certificate is valid from January 2020 through January 2040 so deterministic local tests do not need a certificate generator.

Only the HTTPS tests explicitly trust this certificate through an injected request function's `ca` option. A test-only resolver supplies a synthetic public address; an injected native request adapter routes the socket to the fixture's ephemeral loopback port while preserving its original HTTP Host and TLS server name. Certificate verification stays enabled. The production transport supplies no test CA or loopback exemption, does not disable TLS verification, and never reads these files. All fixture traffic remains on loopback; no real push subscription or provider is contacted.
