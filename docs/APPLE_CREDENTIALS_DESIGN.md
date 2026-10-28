# Apple credential-save design

October 28, 2026. Implements the next [signing item](APPLE_SIGNING_OUTCOME.md).
See [official research and alternatives](APPLE_CREDENTIALS_RESEARCH_2026_10.md)
and the separate [outcome](APPLE_CREDENTIALS_OUTCOME.md).

## Boundaries

Extract private-key admission from signing-credential capture into one reusable
function in the existing signing policy. Keep the runtime signer contract and
cache unchanged. A small Apple credential-validation module adapts failures to
static HTTP 400 validation_error messages without PEM, native error or cause.

The provider secret extractor uses an optional value normalizer only for Apple;
other providers retain their current trimming behavior. Apple replacement input
must be a JSON string of at most 16,384 UTF-8 bytes before trimming. Blank means
keep the existing secret. Nonblank input must parse as an unencrypted private
EC/prime256v1 PEM. PKCS8 and SEC1 remain supported; arbitrary objects, public keys,
other algorithms/curves and indirect loader descriptors are refused.

Settings normalization validates only submitted Team ID/key ID values. Empty
strings remain valid for staged setup and reset; otherwise require exactly ten
ASCII letters or digits. Trim surrounding whitespace and preserve case. No
full-tuple completeness requirement, saved-secret read, key/account lookup or
provider request is introduced. Existing legacy values omitted from a patch are
not revalidated; submitting an invalid legacy value requires correction.

## Mutation behavior

Keep the existing protected PUT /api/v1/settings route: current administrator,
fresh-session policy and CSRF validation precede the service. The repository's
fresh-session policy refuses accounts required to change their password; this
change does not add a recent-authentication time window.

Capture and validate replacements synchronously before any asynchronous work.
Keep secrets removed from sanitized settings updates and audit values. Validation
of every settings field completes before opening the existing write transaction.
Invalid combined patches must leave ordinary settings, all provider secrets and
settings audit events unchanged. A native secret-write failure must roll back
ordinary settings written earlier in that transaction. Audit transaction ownership
is unchanged: the normal success audit still occurs after commit.

Omitted/blank replacement retains its ciphertext and timestamp. A valid nonblank
replacement plus clear=true remains a conflict. Explicit clear independently
removes only the stored secret, allowing the existing environment fallback. IDs
may be edited independently; a private key alone may be rotated. Required
encryption configuration and metadata/status ownership remain unchanged.

## Qualification

Focused tests cover native key kinds, bounded input, encrypted PEM, partial edits,
input capture, clear conflicts, ID type/length/character rules and sanitized
failures. A guarded packaged native HTTP/PostgreSQL entry verifies authorization,
encrypted round trips, rejected combined patches without durable effects, blank
retention, rotation, clear/fallback and actual transaction rollback under an owned
fixture trigger. The trigger belongs only to a disposable database.

The existing Apple HTTPS entry qualifies unchanged runtime signing/transport
after the policy extraction. Freeze source and run one complete fast gate. Use
the [Docker design](LOCAL_DOCKER_APPLE_CREDENTIALS_DESIGN.md) for exact packaged
parity, existing walkthrough preservation and retained unrelated evidence.
