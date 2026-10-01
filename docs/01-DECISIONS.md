# 01. Locked architectural decisions

These decisions refine and supersede the exploratory conversation. Changes require a written ADR
based on a demonstrated blocker, not a preference for another stack.

| Area | Decision | Reason |
|---|---|---|
| Product | Framework packages plus a reference PWA | Reusable outside our own shell |
| Priority | Phone-first, then adaptive tablet and desktop | Explicit user requirement |
| Shell | React, Ionic React, Vite, strict TypeScript | Cohesive mobile navigation and controls [S09] |
| Plugin UI contract | Versioned mount/session RPC in isolated iframe | Framework-neutral rendering with host boundary |
| Reference UI SDK | React first; Lit second | One ergonomic starter and one cross-framework proof |
| Microfrontend frameworks | No Backstage, Module Federation, or single-spa dependency in v1 | They do not replace capability security |
| Wasm | Component Model, WIT, Rust guest, pinned Jco build transformation | Portable service ABI [S12,S13] |
| Async guest I/O | Event/effect bridge | Do not pretend synchronous WIT imports can await fetch |
| Worker JS | Host-owned loader plus validated, trusted-toolchain output | Wasm safety does not make arbitrary JS safe |
| Runtime scheduling | On demand, one visible plugin UI, two active guest workers by default | Mobile memory and battery |
| Reconciliation | Event driven while active, durable desired state | No always-running browser daemon |
| Service worker | Offline shell/assets and update management only | Not a persistent plugin execution host [S18] |
| Storage | IndexedDB transactions, OPFS when available, fallback blobs | Recovery first; browser quota remains real [S11] |
| Personal server | TypeScript/Fastify, SQLite, same-origin HTTPS PWA/API | Small user-controlled integration surface |
| AI | Provider adapter behind principal-bound capability checks | One integration, no plugin credentials |
| ChatGPT | Supported local OSS flow first; hosted path gated | Current program and custody constraints [S01-S08] |
| Billing fallback | Off and impossible without explicit separate consent | Avoid unexpected charges |
| Distribution | Signed GitHub release packages first; OCI adapter by M8 | Immediate Git install with upgrade path |
| Registry | Small curated signed catalogue first | Avoid premature multi-tenant marketplace complexity |
| Dependencies | Optional service bindings, explicit provider selection | No automatic permission inheritance |
| Trust | Restricted host-rendered or isolated-web; first-party UI is build-time only | No unsafe one-click “trust arbitrary JS” mode |
| Release | Evidence gates, actual device QA, real OAuth/inference gate | Passing mocks do not prove the product |

## Version selection

Do not invent “latest” versions in the handoff. M0 must resolve a mutually compatible, maintained set
of Node LTS, pnpm, React/Ionic/router, Vite, Playwright, Rust, wasm-tools, and Jco; run peer-dependency
and smoke tests; then commit exact package versions, lockfiles, compiler toolchain, container digests,
and GitHub Action commit SHAs. Use `docs/REFERENCES.md` as the research baseline. This is a mechanical
compatibility step, not permission to revisit the architecture.

Ionic routing integration must be tested against the chosen React/router pair. Do not mix a current
router with an older Ionic adapter by force-installing peer conflicts. If needed, use Ionic components
with one maintained compatible router and document ownership of transitions/back navigation.

## Important corrections to the early vision

Pasting a repository URL does not make arbitrary source code a plugin. The repository must publish a
PWACloud-compatible release or run the provided publisher workflow. Worker termination bounds a hung
guest best-effort; it is not a browser-wide CPU or memory quota. Iframes and Shadow DOM do not create
universal network isolation. WIT describes interfaces but does not automatically create cross-Worker
RPC or resolve dependencies. A signature authenticates an artifact/signing identity, not its goodness
or source equivalence. A hosted web login is not automatically authorization for plan inference or a
multi-tenant token vault.

The universal UI ABI is the isolated-session protocol, not Web Components alone. Web Components
remain a useful implementation technique, especially for Lit and reusable design elements.
