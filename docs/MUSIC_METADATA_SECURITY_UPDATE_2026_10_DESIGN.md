# Music metadata security update design

Status: Accepted for implementation
Research date: October 8, 2026
Baseline: `d405771b430f1271445f94e07443de836409ed85`, main

## Trigger and official evidence

Fresh npm audit reports one moderate affected package, `music-metadata` 11.15.0,
through two parser advisories. The configured security gate permits this severity,
but a compatible fixed release is available and the application parses observed
library files through the package's `parseFile` API. Updating removes the affected
dependency version without expanding the recovery feature's source scope.

URLs came from the audit response; MCP/web tools opened them and followed
returned maintainer/release links. npm registry metadata confirms 11.16.0 and
Node >=18 support, compatible with actual local Node 24.18.1/npm 12.0.2.
Consultation date is distinct from advisory publication dates.

| Primary source | Applicable decision |
| --- | --- |
| [MP4 maintainer advisory](https://github.com/Borewit/music-metadata/security/advisories/GHSA-f94x-6692-553q) | Describes a sample-entry loop regression. Its historical text says master-only/11.14.0 unaffected; do not infer that exact exploit is demonstrated in this application's 11.15.0 installation. Current audit identifies versions below 11.16.0. |
| [EBML maintainer advisory](https://github.com/Borewit/music-metadata/security/advisories/GHSA-5gfj-9q3v-qfp3) | Describes unchecked element sizes and runtime-dependent excessive allocation/process abort. Parsing untrusted observed files is a relevant dependency boundary; application exploit reachability is not established by inventory. |
| [Official 11.16.0 release](https://github.com/Borewit/music-metadata/releases/tag/v11.16.0) | Verify current parser fixes from maintained release metadata where historical advisory text still describes an open/unreleased fix. Adopt the supported 11.x release. |

## Alternatives and final recommendation

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep the moderate finding because the gate passes | No dependency diff | Leaves an ordinary patched-version update undone | Reject |
| Force a new major or add another parser | Broader reset | Unnecessary API/tooling changes and duplicate parsing ownership | Reject |
| Update the direct compatible minor and lock closure | Removes affected version; retains existing parser/service boundary | Actual tag/artwork consumers and parser controls need validation | Adopt |
| Add first-party copies of third-party vulnerability implementations | Local assertions | Mirrors internals and increases maintenance without securing the dependency | Reject |

Raise `music-metadata` to `^11.16.0` with ordinary resolution and no install
scripts. Inspect manifest/lock changes for the actual selected closure, verify
all-severity audit and clean install. Keep the existing extraction service and
error handling; no CommonJS source, new dependency, override or runtime-major
upgrade is required.

## Validation and outcome

Run focused tag-extraction/embedded-artwork tests and real test-owned media through
the ESM parser and application extraction adapter. Malformed controls should be
bounded by an isolated process/time limit; do not run unbounded allocation/loop
proofs in the application process. Distinguish normal parsing compatibility,
malformed refusal, dependency removal and application exploit reachability.

Follow with frozen-source full application validation and security gate. Record
executed versions/results in a separate outcome. No release, published image,
branch, PR merge, advisory suppression or parsing-policy expansion is proposed.
