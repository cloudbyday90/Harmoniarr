# Apple local signing-status design

October 28, 2026. Follows the next [credential-save item](APPLE_CREDENTIALS_OUTCOME.md).
See [official research and tradeoffs](APPLE_STATUS_RESEARCH_2026_10.md) and
the separate [outcome](APPLE_STATUS_OUTCOME.md).

## Response contract and ownership

Keep configured and the three existing presence booleans unchanged. Add
localSigning with state (incomplete, invalid or valid) and checks containing
teamId, keyId and privateKey (each missing, invalid or valid). Any invalid check
takes priority; otherwise a missing check makes the summary incomplete. Only
three valid checks produce valid. These are local observations, not provider
connection acceptance. No caller gains permission to perform provider operations.

For example, nonempty IDs and a malformed stored key still produce configured:
true, with this additional summary:

```json
{"state":"invalid","checks":{"teamId":"valid","keyId":"valid","privateKey":"invalid"}}
```

Put this projection in a small ESM policy module using the existing save
normalizers, including the shared raw 16 KiB PEM bound and P-256 admission.
Whitespace-only normalized values are missing. Non-string IDs/keys, wrong ID
shape and unsupported keys are invalid. Never return normalized inputs, key
objects, parser errors, tokens or fingerprints. Do not sign or contact Apple.

The status service remains a factory using existing injected readers. Forward
the supplied queryable to both settings and secret resolution. Capture ID and
storefront primitive values before the secret await. This avoids mutable settings
references; it does not create a transaction or an atomic two-store snapshot.
Keep stored-key precedence and environment fallback unchanged. Recompute on each
read; do not cache or persist parsed material or results.

## Failure and access behavior

Classify validation exceptions only inside the value policy. Failures reading
settings/secrets must remain failed requests, not missing/invalid credentials.
Preserve the existing database-connection classification as bounded 503
database_unavailable; other read failures become bounded 500
apple_music_status_unavailable. Neither carries a native cause or raw message.

Existing GET /api/v1/providers/status requires an authenticated session, including
the currently allowed requester role. System overview retains its administrator
boundary. Existing global API no-store headers remain; no route, mutation, CSRF,
SQL/schema or UI control changes. GET must not change settings, encrypted secrets
or settings audit records, including invalid legacy rows and corrupt ciphertext.

## Qualification

Use focused service tests for presence compatibility, each field state, native
key types, queryable forwarding, mutable-settings capture, no retained cache and
bounded failure classification. Retain signer/save/resolver and status-consumer
regressions. A new guarded native HTTP/PostgreSQL entry reads actual encrypted
stored/environment credentials, invalid legacy rows, corruption and recovery;
checks current authorization/no-store and exact no-write projections. Inject an
observable provider HTTP owner that must remain unused by status reads.

Freeze source before the complete fast gate and fresh image build. The separate
[Docker design](LOCAL_DOCKER_APPLE_STATUS_DESIGN.md) owns exact runtime comparison,
immutable-image native checks, preserved walkthrough and retained unrelated proof.
