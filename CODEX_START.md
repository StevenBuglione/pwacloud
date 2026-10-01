# Codex: build PWACloud end to end

You are implementing the mobile-first PWACloud framework for Steven Buglione. This directory is a
research-backed implementation handoff with reference tests, not the finished application.
The user has authorized a **public** repository named `StevenBuglione/pwacloud`.

## First actions

Read `AGENTS.md`, `docs/01-DECISIONS.md`, `docs/05-SECURITY.md`, `docs/06-OPENAI.md`,
`docs/12-TESTING.md`, and `planning/milestones.json`. Run the existing reference tests and audits.
Inspect this checkout and remote before modifying anything. Preserve existing commits if the target
already exists. Use `scripts/publish-github.ts --publish` only in an authenticated environment with
repo-creation and content-write access. The script refuses an existing remote repository and never
changes an existing repository's visibility. Follow `docs/14-OPERATIONS.md` for the existing-repo case.

## Deliver the product, not another proposal

Create the target pnpm workspace described in `docs/02-ARCHITECTURE.md`. Keep the reference code until
its invariants are ported and tested in the real modules. Choose and lock compatible maintained
versions in M0; record actual installed versions and licenses, not guesses. Implement milestones M0
through M10 in dependency order. Keep M11, the externally gated hosted launch, visibly blocked until
authorization exists. Continue all independent work when a real login or device is unavailable.

The essential proof is: on a phone-sized PWA, install a signed plugin from a Git repository release,
review permissions, open a rich full-screen UI, execute a real Wasm service in a Worker, persist data,
make a permitted brokered HTTP request, deny an ungranted request, use authorized ChatGPT inference,
stream results, suspend/resume without corrupting work, revoke AI permission, and uninstall cleanly.

The first three example plugins are Notebook (React rich text plus local Wasm analysis), Feed Reader
(Lit plus approved HTTP), and Canvas Board (React/SVG/canvas plus a scoped Notebook tool binding).
There must also be a hostile fixture suite. Samples in `examples/manifests` describe intended packages;
they are not already built plugins.

## Execution discipline

Build M0's feasibility spikes before the larger shell. Validate opaque-origin iframe asset loading,
message binding, CSP behavior and Jco output in Chromium and WebKit. Record iframe self-navigation
as a known residual channel, not a passing no-egress claim. Implement HTTP/SSE with durable server
run IDs and reconnection before adding agents. Use an effect/event ABI for asynchronous Wasm host work.

Run fast tests per change, integration tests per slice, and production-build mobile tests per milestone.
Capture screenshots, accessibility output, HAR or endpoint observations as appropriate, and redacted
logs. Never mark physical iPhone/Android tests passed using Playwright emulation alone. Never label
mocked OAuth or mock model output as a working ChatGPT integration.

## Provider constraints

Make `chatgpt-plan-local` the supported reference path for eligible users with a personal runtime.
Persist credentials only in the permitted user-controlled local store. Keep hosted and VM persistence
paths gated as documented. Native mobile-only OAuth is not implemented by pretending a phone can
receive a desktop loopback callback. Plan-use entitlement, PWA identity and plugin grants are separate.

## Finish each work session

Commit coherent changes with a factual message. Update the progress ledger. Report the exact build,
tests, measured UX behavior, and blockers. Continue implementation across milestones rather than
stopping after generating README files. Do not ask for optional technology choices already resolved here.
