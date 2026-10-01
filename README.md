# PWACloud
## Mobile-first, installable applications with a permissioned plugin ecosystem

**Status: implementation handoff and tested reference primitives, not a completed PWA.**
Prepared 2026-10-01 for Steven Buglione. Intended public repository: `StevenBuglione/pwacloud`.
No remote repository was created from the authoring session. See `PUBLICATION_STATUS.md`.

PWACloud combines a phone-first application shell, expressive isolated plugin UIs,
WebAssembly services, a declarative lifecycle controller, signed Git-to-package distribution,
and a central AI capability. Eligible ChatGPT-plan usage is a core integration, not an API-key
upsell. Local functionality remains useful without an account or AI connection.

## Start here

1. Read `CODEX_START.md` and `AGENTS.md`.
2. Read `docs/00-PRODUCT.md`, `docs/01-DECISIONS.md`, and `docs/06-OPENAI.md` before writing application code.
3. Execute the dependency-ordered work in `planning/milestones.json` and `docs/13-IMPLEMENTATION.md`.
4. Publish the handoff with `scripts/publish-github.ts` only from an authenticated developer environment.
5. Implement, run, and preserve real evidence. Do not stop at a UI mockup or this documentation.

## What already exists here

Original TypeScript reference primitives for policy checks, an on-demand reconciler, immutable
package integrity, ChatGPT request shaping, stream parsing, local request admission, and release
evidence validation. Unit tests run with Node's built-in test runner. JSON Schema contracts,
SQL persistence contracts, fixtures, and a structural audit are supplied as executable specifications.
These primitives are deliberately small; they are not production security middleware.

```sh
# Node 22.16+ for this dependency-free reference harness; use a maintained patched LTS for deployment.
node --experimental-strip-types --test tests/unit/*.test.ts
python scripts/audit_handoff.py
# jsonschema is required only for the schema audit:
python scripts/validate_contracts.py
```

`evidence/AUTHORING-VALIDATION.md` records exactly what was run. No browser, real-device,
OAuth, hosted deployment, or real model call is claimed by those checks.

## Target product stack

React + Ionic React + Vite + TypeScript for the phone-first shell; a framework-neutral
iframe/RPC contract for full plugin apps; Rust/WIT WebAssembly components transformed with
pinned Jco tooling; dedicated Workers; IndexedDB/OPFS; a small TypeScript/Fastify personal
runtime; GitHub Releases first, OCI transport next. See the locked decisions for exceptions.
Do not add Backstage, Module Federation, single-spa, Kubernetes, Redis, or a general workflow
engine merely because earlier discussion mentioned them.

## Critical limitations

Hosted ChatGPT-plan launch requires an approved integration and clarified credential custody.
The reference local route uses the user's own runtime and supported OAuth, never private
ChatGPT endpoints or copied Codex credentials. A public source repository is not approval.
Arbitrary JavaScript UI is not a perfect no-egress sandbox. A mobile browser is not an
always-on server. These are product constraints, not TODOs that can be hidden.

## Main documents

| Document | Purpose |
|---|---|
| `docs/02-ARCHITECTURE.md` | Components, transport, trust boundaries, placement |
| `docs/03-MOBILE-UX.md` | Screen-by-screen phone UX and interaction contract |
| `docs/04-PLUGIN-PACKAGE.md` | Manifest, build profile, signatures, compatibility |
| `docs/05-SECURITY.md` | Threat model and hard security rules |
| `docs/06-OPENAI.md` | Verified integration, permissions, restrictions, gates |
| `docs/07-LIFECYCLE.md` | Install, update, rollback, resume, uninstall |
| `docs/08-SDK-RPC.md` | TypeScript SDK, WIT effects, RPC and agent tools |
| `docs/09-MARKETPLACE.md` | Distribution, discovery, moderation and publisher UX |
| `docs/10-DATA.md` | Persistence, ownership and migrations |
| `docs/11-PERFORMANCE.md` | Phone budgets, instrumentation and accessibility |
| `docs/12-TESTING.md` | Unit, integration, hostile-plugin and device acceptance |
| `docs/13-IMPLEMENTATION.md` | Ordered milestones with exit conditions |
| `docs/14-OPERATIONS.md` | Bootstrap, environments, release and recovery |
| `docs/15-RISKS.md` | Explicit unresolved external decisions |
| `docs/16-DEMO.md` | End-to-end proof scenarios |
| `docs/REFERENCES.md` | Dated primary-source research |

License: MIT. Working name and package namespace require a public-name collision review
before branding or publishing npm packages.

## Reference harness dependencies
Unit tests use Node built-ins and do not need `npm install`. Reference typechecking was tested with
TypeScript 5.8.3; `npm run typecheck:reference` needs `tsc` installed, or run
`npm exec --yes --package typescript@5.8.3 -- tsc -p tsconfig.reference.json` in a networked environment.
Install schema-test dependencies with `python -m pip install -r requirements-dev.txt`.
These are authoring-harness versions, not a recommendation to deploy an unpatched historical runtime.
M0 selects the maintained production toolchain and adds its real lockfiles.
