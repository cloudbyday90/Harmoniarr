# Local HTTPS push fixture

The certificate and private key in this directory are synthetic, public test data for localhost and 127.0.0.1. They are not deployment credentials. The self-signed certificate is valid from January 2020 through January 2040 so deterministic local tests do not need a certificate generator.

Only the HTTPS tests explicitly trust this certificate through an injected request function's `ca` option. Certificate verification stays enabled. The production transport supplies no test CA, does not disable TLS verification, and never reads these files. All fixture traffic remains on loopback; no real push subscription or provider is contacted.
