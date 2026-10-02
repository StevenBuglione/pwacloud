# M6 personal runtime and supported provider adapter

Implemented strict Origin/CSRF/app-session boundaries, real TLS and expiring one-use pairing, protected local credentials (Windows DPAPI; separate owner key elsewhere), fresh OAuth PKCE/state/nonce and issued registration identity, supported model/Responses encoding, durable SQLite runs/events/idempotency, bounded SSE disconnect grace and resume, restart-safe stable account budgets, cancellation and sign-out races. Local Sigstore receipt authority uses maintained public TUF trust and never substitutes fixture signatures.

Observed owned runtime review34/34 passes and typecheck0 (`runtime-review-tests.txt`). Latest full integration24/24 and security15/15 passed before final removal-intent fixture additions. No human ChatGPT sign-in, inference, real cancellation or physical phone pairing occurred. The user chose automated checks for now. Third-party inference scope and all hosted credential modes stay fail closed.

## Integrated qualification records

Historical slice results above retain their original scope. The complete baseline2364a6813c2319b604bab76beff448aa3c26bab7 passed188 unit,25 integration,20 hostile and56 browser checks locally and in clean Ubuntu Actions run36943590577. Later offline/revocation additions must match their own production build and run. Current source commit, command exit codes and full outputs are recorded centrally in `evidence/M10/local-verification.json`, `ci-current.json` after capture, `verify-all-final-output.txt`, `evidence/browser-results.json`, and `evidence/VERIFICATION.md`. All57 exact contracts and remaining external gates are mapped in `evidence/ACCEPTANCE-DISPOSITION.md`. No historical result certifies later edits.
