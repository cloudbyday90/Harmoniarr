# Native partial-transfer design

October 20, 2026. Add a separate opt-in fault lane around actual slskd 0.26.1.
Use one successful deterministic file as a control, a graceful EOF one byte short
of its declared size, and a partial payload terminated by TCP RST. Preserve
single-file token ownership, bounded framing, exact provider identity and GET-only
recovery. Accepted download admission is distinct from successful completion.

Configure one provider download attempt only in this fault lane. The released
retry helper treats that value as one total invocation; otherwise automatic
retries/resume would confound the intended single-fault observation. Keep product
retry defaults and the existing queue/file/three-minute lanes unchanged.

Expose bounded completed and incomplete tmpfs volumes read-only to the companion
inspector. Before RST, await a bounded observation that a nonzero prefix actually
exists in the provider's incomplete file. A local write callback alone cannot
establish remote receipt. Abort this observation during fixture close and drain
admitted sends after closing socket admission. RST can discard buffered traffic;
inspect the actual retained prefix rather than inventing delivered byte counts.

Drive actual application client/service requests. Require exact failed receipts,
non-success classification, short byte counts and exception evidence. Recover a
controlled lost response by GET without resending; failed terminal evidence must
not become progressed-success recovery. Await the actual native client's empty
download list, then stop and acknowledge the disposable provider before the final
filesystem checks. Its terminal receipt alone is not task retirement or proof
that a late completed file cannot appear.

Verify the positive control's complete content and the failed files' bounded
prefix hashes, stable descriptor/path identity and isolation under incomplete
storage. Require exact trees: no failed file in completed storage and no extra
payload. Keep ESM modules narrow, preserve first Error/null through cleanup and
strictly retire project containers/networks/volumes before deleting secrets.

Fast tests cover fault planning, real socket FIN/RST behavior, held checkpoint
cancellation, storage access and partial-inspection refusal. Native tests own the
real provider behavior. This slice does not claim default retries, resume, music
decoding or library-import coverage. Design/research/outcome and local PR/Docker
evaluation remain separate documents. No PR merge, release or branch is planned.
