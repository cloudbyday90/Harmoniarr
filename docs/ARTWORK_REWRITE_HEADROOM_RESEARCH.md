# Artwork rewrite headroom research and decision

Reviewed October 24, 2026 using MCP discovery/open/navigation. Installed runtime:
Node 24.22.1, Sharp 0.35.5, libvips 8.18.7. Sources describe contracts; local native
evidence determines the reproduced failure stage. See [design](ARTWORK_REWRITE_HEADROOM_DESIGN.md)
and [outcome](ARTWORK_REWRITE_HEADROOM_OUTCOME.md).

| Official source | Applicable practice and limits |
| --- | --- |
| [GLib allocation](https://docs.gtk.org/glib/memory.html) and [realloc](https://docs.gtk.org/glib/func.realloc.html) | Ordinary allocation failure can terminate the process. A surrounding JS catch is insufficient. Current docs cover the GLib API contract; they are not proof of the exact installed allocation stack. |
| [Linux resource limits](https://man7.org/linux/man-pages/man2/prlimit.2.html) | DATA can cause allocation calls to fail with ENOMEM. Keep actual effective limits and kernel counters distinct from per-process usage. This explains a possible mechanism; the private trace did not observe the denying syscall. |
| [Node 24 command-line API](https://r2.nodejs.org/docs/latest-v24.x/api/cli.html) | Old-space limits govern one V8 heap section. They are separate from native buffers and the DATA ceiling. Increasing the heap flag is not the selected fix. |
| [Sharp metadata/statistics](https://sharp.pixelplumbing.com/api-input/) | Metadata inspection reads headers without full pixel decoding; statistics derive from pixels. The replay places the failure in rewrite before statistics, so a statistics-only change would miss the reproduced boundary. |
| [Sharp output](https://sharp.pixelplumbing.com/api-output/) and [security](https://sharp.pixelplumbing.com/security/) | Account for actual native output work before returned-buffer validation; retain pixel checks and deployment resource controls. The installed Sharp source uses a native JPEG save-buffer path; no source-level proof identifies the failed GLib allocation. |
| [OWASP file handling](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Validate content and processing/decompressed cost as well as encoded size. Preserve the current restricted formats, metadata validation and explicit refusal. |
| [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Preserve the existing temporary service-unavailability classification for worker resource refusal. A deterministic budget refusal does not promise that an immediate retry of identical work will succeed; do not invent a Retry-After time. |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Keep existing accessible status behavior and separate HTTP/native evidence from rendered or human assistive-technology acceptance. This backend-only change supplies no new accessibility conformance claim. |

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Share the existing parent child estimate with the decoder guard | Removes divergent accounting; deliberately refuses before native rewrite; keeps numeric parent reservations and current limits | More conservative admission: some large encoded/pixel combinations that occasionally succeeded now refuse. Recommended. |
| Catch the native error or retry after an abort | Small apparent change | GLib abort bypasses JS catch; repeated identical work can reproduce it. Reject. |
| Raise DATA, heap or deadlines | Might allow the selected input | Expands the resource envelope without proving safe whole-app headroom. Reject for this round. |
| File-backed rewrite or redesigned output delivery | Could reduce native buffer growth while retaining maximum-size support | Adds temporary-file ownership, cancellation/kill cleanup and protocol work. Consider only as a separate supported-capability design after measurement. |
| Resize before statistics | Could lower statistics cost | Changes dominant-color approximation and does not address the observed rewrite abort. Outside this fix. |
| External image service | Separate operating envelope | Adds deployment/security/transport ownership; not needed for built-in admission. Reject. |

## Final recommendation stack

1. Shared child-work estimate across admission and parent reservation.
2. Deliberate owned memory refusal before grant/rewrite for combinations beyond it.
3. Existing native process, DATA/deadline, aggregate admission and publication fences.
4. Strict native regression requiring the actual small refusal frame and normal close.
5. Focused fast tests plus opt-in native profiles; retain unrelated evidence only
   through exact unaffected-source/runtime comparison, acknowledging changed modules.

No passing selected profile establishes a production minimum or universal native
allocation bound. Private phase sampling can alter a failure's timing; preserve
the successful diagnostic control alongside the reproduced abort.
