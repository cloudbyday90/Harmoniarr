# Provider wire-version recommendations

Consulted 2026-10-20 using GitHub and web-search MCP services. Release metadata
identifies slskd 0.26.0 at commit e42a525d700d6dc343f316447803138b8ea2fbe3.
Native image observations, rather than a tag's shape, identify the wire value.

| Official source and status | Application |
| --- | --- |
| [Released version controller](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Core/API/Controllers/ApplicationController.cs?ref=e42a525d700d6dc343f316447803138b8ea2fbe3), immutable implementation | Version GET returns Program.SemanticVersion. |
| [Released Program](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Program.cs?ref=e42a525d700d6dc343f316447803138b8ea2fbe3), immutable implementation | SemanticVersion comes from informational version before build metadata; its name is not a guarantee of three numeric components. |
| [Released transfer controller](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Transfers/API/Controllers/TransfersController.cs?ref=e42a525d700d6dc343f316447803138b8ea2fbe3), immutable implementation | Batch POST uses caller UUID, private batch lookup and explicit failures. Peer endpoint lookup precedes batch creation; an offline fixture cannot prove successful enqueue. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), IETF HTTP specification | Unknown POST outcome does not authorize automatic resubmission. Preserve the durable attempt and read exact owned evidence. |
| [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), informative guidance | Validate untrusted response shape/version and retain authorization at the action boundary. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), Recommendation | Version information and provenance help consumers interpret data. Applying that idea to private provider evidence is our design inference; W3C does not certify this transport or mandate an allowlist. |
| [Node security announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases?trk=public_post_comment-text), vendor announcement | The announced October 21 patch remains future work on October 20. Qualify the actual published patch. |

## Alternatives and final stack

| Option | Pros | Cons |
| --- | --- | --- |
| Add only the observed exact stable wire value | Fixes current preparation; small auditable policy change; preserves saved raw identity | Each future provider version needs deliberate qualification |
| Strip fourth components or use a compatible range | Fewer future version refusals | Admits unreviewed builds and collapses identities used for durable safety |
| Select a protocol by probing mutation endpoints | Could discover capabilities | An HTTP route or successful health probe does not prove receipt semantics; mutation probes can create unintended work |
| Migrate providers or frameworks | Could change future capabilities | Unrelated architecture and operational cost for this narrow defect |

Recommend the existing Node 24 ESM/npm 12, Express, Vue and PostgreSQL 18 stack,
with the pinned slskd 0.26.0 transport and exact stable wire admission. Keep
modular policy/dispatch/receipt owners and source-reviewed native qualification.
Retain TypeScript 6 with current Vue tooling; the random PR evaluation is separate.
