# 12. Verification strategy and evidence rules

## Three distinct proof levels

**Reference proof:** the supplied pure TypeScript primitives and schema/database fixtures pass their
tests. This only validates the supplied logic. It does not launch a PWA, compile a guest, verify an
actual publisher or authorize ChatGPT.

**Application proof:** a production build launches with real storage, frames, Workers, guest artifacts,
package verification and runtime transport. Provider protocol fixtures are useful here, but remain
fixtures. Integration tests must observe a real boundary, not just mock its wrapper.

**Release proof:** the actual end-to-end system passes the listed browser, hostile-plugin, physical-device,
publisher and real-provider cases. Hosted launch has additional external gates. A blocked test is not
passed; a mock result cannot replace an external prerequisite.

## Test pyramid

Unit tests cover normalized URLs, path boundaries, permission algebra, manifest validation, version
compatibility, dependency cycles, request admission, lifecycle transitions, migrations and SSE parsing.
Use property-based tests for hostile keys, URLs, paths and RPC payloads after the baseline is stable.

Integration tests use a real HTTP server, SQLite/IndexedDB, real Wasm component, real Worker, opaque
iframe, actual archive bytes, test signing keys and controlled network targets. Confirm enforcement by
observing denied server requests and rejected state changes. A mocked fetch returning 403 is not proof
that the broker blocks exfiltration.

End-to-end tests run the production build, not only Vite dev. Exercise install from a local GitHub-like
release fixture and a real public reference release, consent, plugin UI, offline editing, recovery,
update, rollback, cancel, revoke and uninstall. Test both Chromium and WebKit with mobile viewport/touch
settings. Use separate projects for desktop Firefox where compatible. Pin the browser binaries in CI.

Physical-device tests cover installation, OS keyboard, touch, edge/back gestures, sleep/app switching,
Home Screen relaunch, screen readers, low storage and real connection changes. A phone screenshot alone
does not prove an interaction. Include concise steps, outcomes and redacted recording where possible.

## Hostile fixture suite

Create independently packaged hostile fixtures, not runtime flags in the good plugin. Include: forged
principal; port replay after navigation; attempts to read host DOM/storage; direct fetch/image/WebSocket;
self-navigation residual; malformed UI HTML; injected Markdown/SVG; unknown WIT import; arbitrary JS
Worker glue; endless guest loop; memory growth; archive traversal and decompression bomb; invalid or
wrong-identity signature; permission-expanding update; dependency cycle; SSRF redirects/address tricks;
provider prompt injection; AI requests after revoke; and long-lived task after consent expires.

Expected self-navigation behavior must acknowledge that a request can escape before teardown. The test
passes only when the documented risk, conservative data exposure and port revocation behavior are
accurate. It must never support an “all network blocked” marketing claim. Stronger restricted-mode
claims require independent tests proving no untrusted JavaScript executes.

## OpenAI test split

Fixture tests validate OAuth transactions, correct scope handling, request encoding, error shapes,
refresh races, model catalogue and streaming boundaries. Set up these fixtures without any real secret.
The real-provider suite runs only after explicit authorized login, uses short synthetic prompts and
checks actual completed inference plus cancellation. It must not run automatically on every public PR.
Do not fake ID tokens or provider JSON and call that “Sign in with ChatGPT works.”

Hosted prerequisites are verified documents/configuration under the owner's control, not an agent
checking a boolean in a JSON file. Record a redacted reviewer attestation without publishing contracts
or credentials. Where terms and docs conflict, retain the block until resolved.

## Evidence format

For each acceptance case record: case ID; implementation commit; UTC test time; status; actual environment;
commands/steps; exit code where relevant; artifact paths with SHA-256; brief observed outcome; and reviewer
for manual tests. Provider tests record mock vs real. Device tests record emulated vs physical. Failure
must retain its artifact and remediation. Never fill the example `pending` manifest with made-up passes.

`planning/acceptance-cases.json` is the authoritative case inventory. `planning/progress.json` starts
pending. `contracts/evidence.schema.json` defines the report. The reference gate illustrates refusing
missing, mocked or wrong-environment evidence; it cannot prove a report is truthful. CI must capture
artifacts and bind evidence to its actual commit/job. Require human review of manual/external evidence.

## CI lanes

PR lane: contract validation, typecheck, lint, unit, dependency boundaries, production build, browser
integration, hostile smoke suite, accessibility checks and secret scanning using synthetic data.
Release lane: clean checkout, frozen dependency install, complete browser/hostile suites, package
reproducibility check, SBOM/licence review, signed artifacts and redacted evidence. Physical devices and
real-provider checks are separately authorized gates, not secrets-enabled PR jobs.

Do not disable tests with `continue-on-error`, blanket retries or skipped assertions. A small explicit
flaky-test policy can quarantine a test only with an issue, owner and expiry, and cannot waive a security,
real-provider or mobile critical path. `verify:release` must fail if mandatory evidence is missing.

## What counts as complete

A functional local alpha requires all local-alpha cases, including real authorized ChatGPT use and
actual iPhone/Android QA, to pass. Without those external tests it is a development build, even if all
code is implemented. Hosted release additionally needs hosted-specific cases. Non-AI local features
remain releasable with clear labels, but cannot be marketed as completed ChatGPT integration.
