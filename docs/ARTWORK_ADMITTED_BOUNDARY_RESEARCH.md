# Admitted artwork research and recommendation

Reviewed October 24, 2026 through MCP discovery/open, with pinned Node 24.22.1,
Sharp 0.35.5 and libvips 8.18.7. See [design](ARTWORK_ADMITTED_BOUNDARY_DESIGN.md)
and [outcome](ARTWORK_ADMITTED_BOUNDARY_OUTCOME.md).

| Official source | Applicable decision |
| --- | --- |
| [Sharp output](https://sharp.pixelplumbing.com/api-output/) | Use fixed legal encoder settings and file output for one-time fixture preparation. Keep production rewrite settings unchanged. Lower quality changes decoded content and does not establish decoder complexity by encoded size alone. |
| [Sharp metadata/statistics](https://sharp.pixelplumbing.com/api-input/) | Verify metadata separately from actual native processing. Metadata inspection alone cannot qualify decoded pixels or output correctness. |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html) | Use bounded reads through one owned file handle, reject symbolic-link leaves on Linux and close through original-error-preserving cleanup. Size and digest checks are separate from pathname checks. |
| [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) | Consumers receive the prepared directory read-only. This protects the container-side mount; source hash pins still detect changes made by the host owner. |
| [OWASP file handling](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Preserve content, byte and processing-cost checks. Treat prepared fixtures as explicit test inputs; neither an extension nor a self-supplied digest authenticates arbitrary content. |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Preserve existing accessible status behavior. HTTP/native checks here do not establish rendered announcements or human screen-reader/device acceptance. |

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Prepare fixed, hash-pinned files once; run fresh profiles with a read-only mount | Exact input identity, less repeated native setup, clearer workload metrics | Explicit preparation/storage/version ownership; preparation peak is a separate scope. Recommended. |
| Regenerate maximum raw sources in every profile | Self-contained generation and lifetime peak | Repeats expensive WebP encoding and blends generator peak with application sizing. Retain old lanes, but avoid for this new matrix. |
| Pad a smaller file to the arithmetic boundary | Cheap byte-accounting control | Padding does not increase decoded complexity. Not selected for these noisy-source cases. |
| Dynamically choose quality until processing passes | Could find one accepted file | Changes the question and hides failures. Select encoder settings before observing decoder results. |
| Raise memory or deadlines | Might permit harder inputs | Expands the unqualified resource envelope. Not selected. |
| Redesign native output delivery | Might reduce buffer growth | Requires separate temporary-file/protocol/cancellation ownership evidence; decide only if the admitted cases demonstrate a need. |

## Recommendation stack

1. Fixed descriptor and pinned artifact bytes, with explicit separate preparation.
2. Exact file size, bounded owned read, EOF/digest and metadata verification.
3. Existing shared admission and isolated native worker controls.
4. Separate success, owned refusal and failed native qualification evidence.
5. Focused fast checks, opt-in fresh profiles and exact retention of unaffected proof.

Keep the previous strict over-budget refusal regression. No arithmetic or selected
image proves a universal accepted envelope. Record actual decoder outcomes before
choosing the next production change.
