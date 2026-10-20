# Native audio and canonical import design

October 20, 2026. Add one opt-in lane with two declared WAV-sized payloads:
deterministic stereo 16-bit PCM audio and an equal-length corrupt control.
Both must complete actual slskd transfer. Successful transport is not media
acceptance; the corrupt payload must fail media verification and publish no
canonical library file.

Use the existing fresh PostgreSQL/application fixture, real download execution
worker, leased pre-provider preparation, durable handoff/transfer links, actual
transfer summary/reconciliation and canonical apply worker. Seed only controlled
metadata, wanted scope and candidate eligibility. Preserve current authorization,
ownership, maintenance, quality, hash and required-audit guards.

Keep the native provider on its internal network with no published ports.
A bounded host adapter invokes the real application slskd client/service inside
the companion container; it transports actual request/response values, without
substituting accepted receipts or terminal state. Admit one application POST per
candidate and retain exact durable batch/receipt identity.

After real completion and native task retirement, acknowledge provider shutdown,
inspect exact native files through the read-only mount and copy only the two
declared paths into the test-owned downloads workspace. Recheck bounded sizes,
hashes and regular-file identity after export. This copy has a new filesystem
identity; hash equality connects the native and import stages.

Use actual ffprobe from the immutable application image with only the isolated
scenario workspace mounted and networking disabled. Verify PCM metadata,
automatic safe-add, actual apply completion, canonical target bytes/catalog and
audit for the valid file. Verify corruption refusal, retained source and absence
of canonical file/catalog publication for the negative control.

Keep narrow ESM data/peer/bridge/export and integration helpers. Add focused
byte, ownership and export controls, one selected native/PostgreSQL case and
affected native regressions. Preserve cleanup ownership through worker, SQL,
process, socket and Docker retirement. This is not browser/search coverage or
authentication of otherwise valid same-size changed remote media.
