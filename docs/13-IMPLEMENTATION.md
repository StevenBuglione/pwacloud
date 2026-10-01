# 13. Dependency-ordered implementation plan

Execute work, not just documentation. `planning/milestones.json` supplies machine-readable dependencies
and target modules. No calendar estimate is implied. Each milestone requires its own commit and evidence.

## M0: feasibility and repository foundation

Inspect/reuse or create the authorized public repository without overwriting history. Bootstrap the pnpm
workspace and strict TypeScript tooling. Resolve compatible maintained versions and freeze lockfiles.
Run three spikes before building the main app: opaque-frame single-bundle assets plus CSP in Chromium/
WebKit; a real Rust Component Model guest transformed by pinned Jco and run in a Worker; and a clearly
mocked personal-runtime streaming protocol with correct request/identity separation. Record browser
navigation residuals and provider prerequisites. Exit only with runnable spike commands and test artifacts.

## M1: phone-first shell and offline baseline

Implement Home, Library, Discover, Activity and Settings routes using Ionic/React. Add safe areas,
keyboard-aware layouts, host back-stack, theme/text preferences and accessibility primitives. Create the
web manifest, icons and custom service worker with prompt-to-update behavior [S10]. No automatic reload
while edits/tasks exist. Persist a simple local note through real IndexedDB. Test 360-pixel layout and
production-build offline relaunch. Exit with no dead-end navigation or fake sign-in success.

## M2: contracts, scopes and transport

Move the tested reference policy rules into production modules with strict schema validation. Implement
principal-bound frame/Worker handshakes, request correlation, limits, cancellation and revocation. Add
permission sheets and scoped file/document handles. Build the isolated UI loader using verified local
assets. Prove React and Lit content can render and call storage while host DOM and unauthenticated API
access are denied. Exit with hostile-message regression tests and two independently bundled UIs.

## M3: signed packages and repository installation

Implement CLI manifest validation/pack/inspect, deterministic archives, release envelope, digest checks,
Sigstore verification in the personal verifier and browser verification receipts. Build fixture releases
and the real reference release. Implement Resolve -> Review -> Download -> Ready with cancellation and
recoverable errors. Add strict archive and SSRF validation. Exit with a phone-sized app installing a real
signed public reference package by repository URL, without rebuilding the shell.

## M4: guest runtime and lifecycle controller

Implement trusted Jco transformation/loader, WIT effect/event bridge, bounded guest calls, scheduler,
checkpoints, termination and crash backoff. Integrate install journals and multitab fencing. Keep guest
services on demand. Prove a real Wasm output affects the UI, a hanging guest is terminated, and app
resume recreates state without replaying external writes. Exit with verified Worker and lifecycle traces.

## M5: expressive sample plugins and local capabilities

Finish Notebook with rich editing and Wasm text analysis; Feed Reader with Lit, virtualized lists and
brokered HTTP; Canvas Board with responsive SVG/canvas editing and accessible non-drag controls.
Implement quotas, selected-document sharing, network proxy policy, permission revocation and plugin
settings. Sample data is synthetic. Exit with all three usable at 360 pixels, genuine frame/service
boundaries and a denial case observed at the network target.

## M6: personal runtime and actual ChatGPT integration

Implement supported local registration, protected local credentials, session lifecycle, phone pairing,
provider catalogue, direct-plan request adapter, local budgets, durable runs, cancellation and reconnect.
No hosted token vault. Run fixture protocol tests and then an explicitly authorized real sign-in/inference
smoke test. If human login is unavailable, mark that test blocked and continue all independent work.
Exit requires real entitlement evidence, not a mocked spinner or API-key substitution.

## M7: scoped tools and agent composition

Add a small host agent loop using supported tool calls, typed schemas, explicit document handles,
per-tool grants and user confirmation for writes. Demonstrate Notebook -> Canvas Board through an approved
service binding. Add prompt-injection fixtures and maximum-step/run limits. Do not implement arbitrary
shell or install permissions. Exit with an authorized successful composition and a denied escalation.

## M8: update, rollback and marketplace hardening

Add a curated signed catalogue, interface-aware filters, precise verification badges, update diffs,
new-grant consent, staged migrations, safe rollback, uninstall/export and revocation feed. Implement OCI
as another transport over the same artifact contract. Resolve whole dependency graphs explicitly.
Exit with interrupted-update recovery, stale/offline metadata handling and a rejected malicious release.

## M9: framework extraction and device polish

Prove a second minimal non-Ionic embedding host using the packages rather than copying shell internals.
Finish SDK docs and authoring templates. Run accessibility, performance, repeated open/close, real keyboard,
back gesture and background/resume tests. Fix physical-device problems rather than adding screenshots
of emulator passes. Exit with actual iPhone/Android evidence and documented supported browser matrix.

## M10: local alpha release

Run clean-clone frozen install, all code gates, hostile suite, real public Git install, real-provider and
physical-device acceptance. Publish signed code/package releases, accurate README, redacted evidence,
SBOM/license notices and recovery instructions. Verify a clean user installation without development
secrets. No full-completion claim while mandatory cases are blocked. The local-alpha label does not
imply hosted approval.

## M11: approved hosted mobile launch, externally gated

Only after the owner obtains the applicable client/integration authorization, credential-custody decision,
and confirmation of installed-plugin scope, enable the hosted adapter with its exact documented flow.
Test direct mobile sign-in, account isolation, revocation, data retention and abuse protections under
that authorization. This is intentionally a separate release gate. Do not invent permission to finish it.

## Parallel work

After M0, UI and contracts work can proceed in parallel with module ownership. Package/runtime work
needs M2 transport contracts. Provider implementation can use fixtures while waiting for M3/M4 integration.
Security tests should be developed alongside the boundary they test. Use subagents only when available,
with explicit file/module ownership and an integration reviewer. They cannot certify their own unrun tests.
