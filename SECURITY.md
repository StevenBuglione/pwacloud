# Security policy

This repository starts as a pre-release implementation handoff. It is not audited or production-ready.
See `docs/05-SECURITY.md` for the threat model and release blockers.

Do not disclose tokens or private user content in public issues. Enable GitHub private vulnerability
reporting when repository administration is available. Until a private reporting channel is configured,
do not publish a claimed private-security-reporting address. A security fix requires a regression test,
review of related trust boundaries, and an advisory for affected versions when warranted.

Use synthetic data for every public fixture and screenshot. Compromised plugin releases must be
withdrawn from discovery and added to the revocation feed without silently deleting the user's data.
