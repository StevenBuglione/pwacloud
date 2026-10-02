# M5 real example plugins

All three examples are separately built package UIs mounted in opaque-origin frames. They call the public SDK over a principal-bound MessagePort. Their storage, network, selected-document and AI operations pass through host grants. No example fetches its own feed or receives OAuth credentials.

Notebook provides a document picker, normalized plain-text rich formatting, safe preview, undo/redo, local autosave, durable dirty-draft checkpoint, explicit error states and the actual Rust Component Model analyzer in a Worker. Older save completions cannot mark a newer draft clean. Switching documents saves the previous draft; New note now does the same. AI prompts, partial output, model, run ID and event cursor are persisted. Resume subscribes to the existing run; it does not submit another inference.

Feed Reader uses Lit, the granted NASA feed rule and the host HTTP broker. It parses XML into bounded plain-text records, renders a 12-row virtual window, offers previous/next controls and article detail, and saves a durable snapshot. Text scaling changes row height and virtual offsets together. A denied grant makes no HTTP broker call. A refresh failure preserves saved articles. The deterministic test supplies a controlled broker HTTP response, not a claim of a live NASA-server request.

Canvas Board uses React and SVG, with card selection, text/color controls, explicit non-drag movement, pan/zoom and local persistence. Its Notebook import triggers host review for the exact selected saved note. Denial exposes no note data; one-use approval returns only the selected document. Board drafts are checkpointed and an older save cannot clear a newer dirty edit.

## Observed checks

The last owned Chromium/WebKit 20-case run passed every M5 case. `../M9/owned-shell-full-results.json` and `../M9/browser-app-complete-shell.log` retain the exact result. Notebook installs actual signed fixture bytes, waits for complete production precaching, stops its isolated HTTP origin before the first Wasm invocation, checks the real Rust result, then edits and reloads while that origin remains stopped. It verifies hostile text remains text, formatting and undo/redo work, and the saved note survives. Canvas tests denial/approval, non-drag movement, zoom and reopen persistence. Feed tests denied access, the real broker request shape, 75 controlled articles, a 12-row window and offline snapshot retention.

The synthetic AI test checks the exact complete development answer, its saved prompt/output in host Activity, persistence after reopening and denial after revoke. Synthetic output is visibly labeled. It is not ChatGPT-account or provider-inference proof.

The tested fixture archives in production revision `917ba79b6cb1afab` were:

| App | Archive bytes | SHA-256 |
| --- | ---: | --- |
| Notebook | 805322 | `382e49a4be92b360773e82345a02219267dc047d519358d9e3c2dc27e7f3693b` |
| Feed Reader | 487513 | `e72468e8b8e2c603c901342b8bac820503f75a4c69e691289dd6ebc4f182421e` |
| Canvas Board | 697515 | `0434c93c6d854b019e81371a44186dd2f64f3cc1ebb144dcd80c2994097c98d0` |

These are **demo-only fixture signatures**, not Sigstore publication or a safety certification. The subsequent New-note durability source fix requires a fresh build and its newly added assertion; later archive digests must be recorded by that build. Screenshots named for each browser and app are retained in this directory. Physical screen-reader, touch and device eviction gates remain separate.

## Integrated qualification records

Historical slice results above retain their original scope. The complete baseline2364a6813c2319b604bab76beff448aa3c26bab7 passed188 unit,25 integration,20 hostile and56 browser checks locally and in clean Ubuntu Actions run36943590577. Later offline/revocation additions must match their own production build and run. Current source commit, command exit codes and full outputs are recorded centrally in `evidence/M10/local-verification.json`, `ci-current.json` after capture, `verify-all-final-output.txt`, `evidence/browser-results.json`, and `evidence/VERIFICATION.md`. All57 exact contracts and remaining external gates are mapped in `evidence/ACCEPTANCE-DISPOSITION.md`. No historical result certifies later edits.
