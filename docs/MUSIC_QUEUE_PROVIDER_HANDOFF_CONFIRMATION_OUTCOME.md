# Music Queue Provider Handoff Confirmation Outcome

## Delivered behavior

The Music Queue now durably checkpoints a slskd download request before the
provider `POST` begins. The checkpoint records the intended files, their sizes,
the source user, and the rule that confirmation must occur before another
enqueue attempt.

If the call returns normally, Harmoniarr records the accepted transfer IDs as
before. If the process stops or the response is lost after the checkpoint,
Harmoniarr does not send the request again. Instead it queries slskd’s current
downloads for that user and confirms only exact filename-and-size matches.

An unconfirmed request now has a distinct item state:

- Label: `Confirming download request`
- Explanation: Harmoniarr is checking whether slskd accepted the earlier
  request.
- Next action: sync transfer state and inspect Downloader; Harmoniarr will not
  retry the request automatically.

The execution heartbeat also continues to check this state. A fresh download
run is rejected while the selected match has an unconfirmed prior handoff,
which prevents a later manual button press from bypassing the safeguard.

## Modules added or changed

- `src/server/slskd/slskd-download-handoff-reconciliation-service.js`
  performs exact provider-side transfer matching.
- `src/server/import-candidates/import-candidate-execution-worker.js`
  writes the checkpoint, preserves it across a resumed run, and avoids a
  second provider POST.
- `src/server/import-candidates/import-candidate-execution-summary-service.js`
  exposes confirmation evidence to the UI.
- `src/server/import-candidates/import-candidate-execution-reconciliation-service.js`
  turns a fully confirmed handoff into normal download tracking.
- `src/server/import-candidates/import-candidate-execution-service.js` and
  repository guard prevent a new run while confirmation is pending.

## Deliberate trade-off

The safe outcome for a truly ambiguous provider `POST` is to wait for proof,
not to guess and retry. This can require an operator to inspect Downloader and
choose a different match if slskd never exposes the original request. That is
preferable to duplicate downloads, duplicate imports, and confusing recovery
cascades in a home library.

## Next recommended item

Apply the same crash-window audit to local filesystem mutations that occur
outside a PostgreSQL transaction, beginning with backup export and import-apply
rename/move operations. Prefer an operation-specific durable intent and
post-condition check; do not introduce a generic distributed transaction layer.
