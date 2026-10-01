# Starting status for Codex

This archive delivers the complete engineering handoff and executable reference primitives. It does not
contain a working PWA application, completed OAuth implementation, built Wasm guest, live marketplace,
finished sample plugin, or deployed service. Those are the explicitly assigned implementation deliverables.

The 57 product acceptance cases all start pending. Passing reference tests does not mark a milestone done.
Authoring checks are reported separately in `evidence/AUTHORING-VALIDATION.md`.

## Work that can proceed without external authorization
Implement the shell, offline persistence, packaging, signing fixtures, worker runtime, full plugin UI,
controller, scoped networking, protocol fixtures, provider adapter, lifecycle, catalog, SDK and CI.
Use synthetic data and clearly labeled mock AI while implementing. Do not stop all development because
real login, real phones or hosted approval is unavailable.

## External evidence needed for the requested final product
A GitHub-authenticated environment with write permission must publish the repo. A user must complete
real supported ChatGPT authorization and approve the integration smoke test. Physical iPhone and Android
QA must be performed. Smooth consumer hosted sign-in needs applicable authorization plus a resolved
credential-custody model and installed-plugin scope. Mark each unavailable gate blocked, never passed.

The minimal local development command, production run command, deployment environment and any approval
requirements must be documented with actual commands by M10. A mock success screen is not the deliverable.
