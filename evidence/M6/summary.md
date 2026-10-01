# M6 personal runtime and supported provider adapter

Implemented strict Origin/CSRF/app-session boundaries, real TLS and expiring one-use pairing, protected local credentials (Windows DPAPI; separate owner key elsewhere), fresh OAuth PKCE/state/nonce and issued registration identity, supported model/Responses encoding, durable SQLite runs/events/idempotency, bounded SSE disconnect grace and resume, restart-safe stable account budgets, cancellation and sign-out races. Local Sigstore receipt authority uses maintained public TUF trust and never substitutes fixture signatures.

Observed owned runtime review34/34 passes and typecheck0 (`runtime-review-tests.txt`). Latest full integration24/24 and security15/15 passed before final removal-intent fixture additions. No human ChatGPT sign-in, inference, real cancellation or physical phone pairing occurred. The user chose automated checks for now. Third-party inference scope and all hosted credential modes stay fail closed.
