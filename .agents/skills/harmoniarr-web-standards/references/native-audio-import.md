# Standards method for native media publication

Use this reference for the provider-to-library boundary, alongside the
[official research](../../../../docs/NATIVE_AUDIO_IMPORT_RESEARCH_2026_10.md).

1. Name each claim: native receipt, published bytes, inspected media, canonical
   apply, catalogue and required audit. Assign evidence to its real owner.
2. Discover and open official URLs through MCP. Distinguish Recommendations,
   IETF standards, informative security guidance and vendor documentation.
   Record consultation date and label inferred application explicitly.
3. Apply RFC 9110 by retaining one durable application command and exact receipt
   observations. A native retry or completed receipt does not authorize another POST.
4. Apply OWASP content guidance by inference: valid extension/size/transport is
   insufficient. Compare equal-size valid and corrupt payloads with actual
   inspection and canonical workers; refuse export redirection and hash drift.
5. Apply W3C provenance guidance by inference: record immutable runtime/provider
   identity and hash equality across native, exported and canonical bytes.
   Copying creates a new filesystem identity; report that boundary honestly.
6. Verify required system audit, real scan completion and exact catalogue row.
   Corrupt content retains its source and publishes neither target nor row.
   Use focused fast controls plus the opt-in native case; keep skipped/failed
   work out of success claims. See the
   [outcome](../../../../docs/NATIVE_AUDIO_IMPORT_OUTCOME.md).

ffprobe establishes observed stream metadata or refusal, not a full decode,
remote-source authentication, WCAG coverage or private-protocol certification.
Canonical user action/discovery remains separate when eligibility is seeded.
