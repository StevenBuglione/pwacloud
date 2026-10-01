# PWACloud: Mobile-First Codex Implementation Handoff

Prepared for **Steven Buglione** on **October 1, 2026**.
Target public repository: `StevenBuglione/pwacloud`.

**Deliverable status:** complete engineering handoff with executed reference checks. The PWA itself
has not yet been implemented, the 57 product acceptance cases are pending, and the public repository
has not been created in this session. The companion ZIP contains the executable source, contracts,
fixture manifests, scripts and evidence. Give Codex the ZIP, not only this consolidated document.

## Reading map

1. [README.md](#document-1)
2. [CODEX_START.md](#document-2)
3. [AGENTS.md](#document-3)
4. [docs/00-PRODUCT.md](#document-4)
5. [docs/01-DECISIONS.md](#document-5)
6. [docs/02-ARCHITECTURE.md](#document-6)
7. [docs/03-MOBILE-UX.md](#document-7)
8. [docs/04-PLUGIN-PACKAGE.md](#document-8)
9. [docs/05-SECURITY.md](#document-9)
10. [docs/06-OPENAI.md](#document-10)
11. [docs/07-LIFECYCLE.md](#document-11)
12. [docs/08-SDK-RPC.md](#document-12)
13. [docs/09-MARKETPLACE.md](#document-13)
14. [docs/10-DATA.md](#document-14)
15. [docs/11-PERFORMANCE.md](#document-15)
16. [docs/12-TESTING.md](#document-16)
17. [docs/13-IMPLEMENTATION.md](#document-17)
18. [docs/14-OPERATIONS.md](#document-18)
19. [docs/15-RISKS.md](#document-19)
20. [docs/16-DEMO.md](#document-20)
21. [docs/adr/0001-ui-isolation.md](#document-21)
22. [docs/adr/0002-async-effects.md](#document-22)
23. [docs/adr/0003-personal-ai-runtime.md](#document-23)
24. [docs/adr/0004-distribution.md](#document-24)
25. [docs/adr/0005-mobile-lifecycle.md](#document-25)
26. [planning/IMPLEMENTATION_STATUS.md](#document-26)
27. [PUBLICATION_STATUS.md](#document-27)
28. [evidence/AUTHORING-VALIDATION.md](#document-28)
29. [docs/REFERENCES.md](#document-29)

---

<a id="document-1"></a>

# Source: `README.md`

## PWACloud
### Mobile-first, installable applications with a permissioned plugin ecosystem

**Status: implementation handoff and tested reference primitives, not a completed PWA.**
Prepared 2026-10-01 for Steven Buglione. Intended public repository: `StevenBuglione/pwacloud`.
No remote repository was created from the authoring session. See `PUBLICATION_STATUS.md`.

PWACloud combines a phone-first application shell, expressive isolated plugin UIs,
WebAssembly services, a declarative lifecycle controller, signed Git-to-package distribution,
and a central AI capability. Eligible ChatGPT-plan usage is a core integration, not an API-key
upsell. Local functionality remains useful without an account or AI connection.

### Start here

1. Read `CODEX_START.md` and `AGENTS.md`.
2. Read `docs/00-PRODUCT.md`, `docs/01-DECISIONS.md`, and `docs/06-OPENAI.md` before writing application code.
3. Execute the dependency-ordered work in `planning/milestones.json` and `docs/13-IMPLEMENTATION.md`.
4. Publish the handoff with `scripts/publish-github.ts` only from an authenticated developer environment.
5. Implement, run, and preserve real evidence. Do not stop at a UI mockup or this documentation.

### What already exists here

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

### Target product stack

React + Ionic React + Vite + TypeScript for the phone-first shell; a framework-neutral
iframe/RPC contract for full plugin apps; Rust/WIT WebAssembly components transformed with
pinned Jco tooling; dedicated Workers; IndexedDB/OPFS; a small TypeScript/Fastify personal
runtime; GitHub Releases first, OCI transport next. See the locked decisions for exceptions.
Do not add Backstage, Module Federation, single-spa, Kubernetes, Redis, or a general workflow
engine merely because earlier discussion mentioned them.

### Critical limitations

Hosted ChatGPT-plan launch requires an approved integration and clarified credential custody.
The reference local route uses the user's own runtime and supported OAuth, never private
ChatGPT endpoints or copied Codex credentials. A public source repository is not approval.
Arbitrary JavaScript UI is not a perfect no-egress sandbox. A mobile browser is not an
always-on server. These are product constraints, not TODOs that can be hidden.

### Main documents

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

### Reference harness dependencies
Unit tests use Node built-ins and do not need `npm install`. Reference typechecking was tested with
TypeScript 5.8.3; `npm run typecheck:reference` needs `tsc` installed, or run
`npm exec --yes --package typescript@5.8.3 -- tsc -p tsconfig.reference.json` in a networked environment.
Install schema-test dependencies with `python -m pip install -r requirements-dev.txt`.
These are authoring-harness versions, not a recommendation to deploy an unpatched historical runtime.
M0 selects the maintained production toolchain and adds its real lockfiles.

---

<a id="document-2"></a>

# Source: `CODEX_START.md`

## Codex: build PWACloud end to end

You are implementing the mobile-first PWACloud framework for Steven Buglione. This directory is a
research-backed implementation handoff with reference tests, not the finished application.
The user has authorized a **public** repository named `StevenBuglione/pwacloud`.

### First actions

Read `AGENTS.md`, `docs/01-DECISIONS.md`, `docs/05-SECURITY.md`, `docs/06-OPENAI.md`,
`docs/12-TESTING.md`, and `planning/milestones.json`. Run the existing reference tests and audits.
Inspect this checkout and remote before modifying anything. Preserve existing commits if the target
already exists. Use `scripts/publish-github.ts --publish` only in an authenticated environment with
repo-creation and content-write access. The script refuses an existing remote repository and never
changes an existing repository's visibility. Follow `docs/14-OPERATIONS.md` for the existing-repo case.

### Deliver the product, not another proposal

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

### Execution discipline

Build M0's feasibility spikes before the larger shell. Validate opaque-origin iframe asset loading,
message binding, CSP behavior and Jco output in Chromium and WebKit. Record iframe self-navigation
as a known residual channel, not a passing no-egress claim. Implement HTTP/SSE with durable server
run IDs and reconnection before adding agents. Use an effect/event ABI for asynchronous Wasm host work.

Run fast tests per change, integration tests per slice, and production-build mobile tests per milestone.
Capture screenshots, accessibility output, HAR or endpoint observations as appropriate, and redacted
logs. Never mark physical iPhone/Android tests passed using Playwright emulation alone. Never label
mocked OAuth or mock model output as a working ChatGPT integration.

### Provider constraints

Make `chatgpt-plan-local` the supported reference path for eligible users with a personal runtime.
Persist credentials only in the permitted user-controlled local store. Keep hosted and VM persistence
paths gated as documented. Native mobile-only OAuth is not implemented by pretending a phone can
receive a desktop loopback callback. Plan-use entitlement, PWA identity and plugin grants are separate.

### Finish each work session

Commit coherent changes with a factual message. Update the progress ledger. Report the exact build,
tests, measured UX behavior, and blockers. Continue implementation across milestones rather than
stopping after generating README files. Do not ask for optional technology choices already resolved here.

---

<a id="document-3"></a>

# Source: `AGENTS.md`

## Agent implementation contract

The user wants a working, tested mobile-first platform, not a prototype screenshot or more planning.
Use `CODEX_START.md` as the execution order. Existing handoff tests are reference tests, not proof
that the target application is done.

### Non-negotiable rules

- Implement in small vertical slices. Every milestone includes runnable behavior, tests, and evidence.
- Phone layout comes first. Test 360 CSS-pixel width before enhancing tablet/desktop layouts.
- Never invent an OAuth client ID, provider scope, model entitlement, approval, signature, test result,
  deployment URL, Git commit, app-store availability, or real-device result.
- Never put OAuth credentials in browser storage, plugin packets, URLs, logs, telemetry, git, or examples.
- Use only supported OpenAI flows. No scraping ChatGPT, backend-api calls, borrowed client IDs,
  reading another tool's auth store, quota rotation, shared subscriptions, or public AI relay endpoints.
- Keep hosted plan-sharing and remote credential persistence disabled unless the applicable written
  authorization resolves the gates in `docs/06-OPENAI.md` and `docs/15-RISKS.md`.
- A denial, missing scope, exhausted allowance, or provider failure must not trigger paid API fallback.
- Fail closed on package verification, compatibility, identity binding, permission changes, or stale grants.
- A plugin's claimed ID, publisher, permissions, or role is not authoritative. Bind principal on transport creation.
- Do not load third-party UI or uploaded Jco JS glue into the shell's JavaScript realm.
- Never call a sandboxed iframe a complete outbound-network or CPU isolation boundary.
- Use a real Component Model artifact and a real Worker in integration tests; a fake JS function is not Wasm.
- Browser suspension is expected. Persist work and resume explicitly. No simulated always-on controller.
- Never weaken a test, delete a failing assertion, suppress errors, or rename skipped work to passed.
- Mock AI is acceptable for development and deterministic transport tests only. Visibly label it.
- Real ChatGPT integration requires an authorized human sign-in. A blocked integration remains blocked.
- No real secrets, user files, prompts, access tokens, or account identifiers in public evidence.
- Do not spend money, provision paid infrastructure, accept commercial terms, or buy domains.
- Publish only to `StevenBuglione/pwacloud`, public, using authorized credentials. Preserve any existing history.
  Do not convert another repository's visibility or force-push.

### Engineering style

All production host/SDK/server JavaScript is authored as strict TypeScript. Use Rust for the first
small guest. Schemas and generated bindings are versioned. Runtime input remains untrusted despite
TypeScript types. Use a maintained schema validator at every boundary. Avoid `any`, unchecked casts,
and handwritten cryptography. Pin tested dependencies and Actions to resolved versions/commit SHAs.
Keep comments focused on invariants and boundary assumptions. No framework shopping after M0 without
an ADR explaining an observed blocker.

### Work log

Update `planning/progress.json` after each slice. Record implemented behavior, changed files, commands,
exit codes, failures, blockers, commit SHA, and evidence paths. Add `evidence/<milestone>/summary.md`.
The progress file is a record, not acceptance evidence by itself. Retain raw test outputs and artifacts.

### Completion

A milestone is complete only if its acceptance cases pass against the actual implementation. Release
requires the exact gate list in `planning/acceptance-cases.json`, with physical-device tests where marked.
Summarize what works, what was tested, and what remains blocked. Never say the entire product is done
because the seed tests or mocked provider pass.

---

<a id="document-4"></a>

# Source: `docs/00-PRODUCT.md`

## 00. Product definition

### Thesis

PWACloud is a reusable, open, mobile-first application framework plus a reference application.
It lets a person install independent tools into one PWA, give each tool narrowly scoped capabilities,
and use them through genuinely rich interfaces. The same installation can be used on a phone,
tablet, and computer, but the phone is the design center. The framework can also be embedded in
another PWA without forcing that application to copy this reference shell.

The differentiator is not “WebAssembly runs in a browser.” It is the complete route from a publisher's
Git repository to an understandable, permissioned, reversible installation, combined with a shared
AI integration that does not distribute credentials to plugins.

### Who uses it

The primary end user wants useful tools on a phone without repeatedly configuring accounts or API
keys. They understand an app library, permission sheet, and task history; they should not need to
understand pods, OCI, WIT, workers, containers, or deployment reconciliation. The plugin author wants
the rendering freedom of web development and a documented SDK. The embedding developer wants to
add this extension system to an existing product. The operator wants auditable releases and no
surprise infrastructure or AI bills.

### Core journeys

A new user opens the reference PWA, sees a useful offline-capable notebook, and can explore without
signing in. The Library contains installed tools. Discover shows a curated catalogue with actual
screenshots, an honest permission summary, and device compatibility. “Install from repository” accepts
a supported GitHub repository URL. It resolves a compatible signed release, asks for permissions,
and installs without rebuilding the main PWA.

The user opens a plugin as a full-screen mobile application. It can edit text, display virtualized
lists, draw on a canvas, use SVG charts, or compose a responsive multi-panel interface on a tablet.
When it needs a host feature it calls a typed SDK. The host grants, denies, or prompts without giving
it credentials or control of the surrounding application.

The user connects their eligible ChatGPT plan through the supported PWACloud integration. A plugin
can then request AI as part of the user's activity, with its own permission and local request budget.
The user can cancel a run, inspect the responsible plugin, or revoke access. Offline tools keep
working when the provider is unavailable.

### What version 1 includes

A mobile shell; install/update/disable/uninstall; signed release resolution; an expressive isolated UI
profile; an optional restrictive host-rendered profile; real Wasm workers; scoped storage and network;
a local/user-controlled AI integration; a curated catalogue; versioned contracts; three real sample
plugins; hostile fixtures; transparent diagnostics; accessible onboarding; and tested recovery.

The reference app is free to use with ChatGPT-plan integration where authorized. No paywall, subscription
resale, quota pooling, or background consumption by default. Later commercial services require separate
product and provider review. This is a product decision, not a claim that all OpenAI programs share
identical commercial rules. See the specific source constraints in `06-OPENAI.md`.

### What version 1 does not include

No native App Store submission, arbitrary source-code builds on install, full Kubernetes, distributed
browser clusters, unrestricted shell inside a PWA, private Git repository credential management,
automatic installation of transitive UI apps, paid marketplace, real-time collaboration, full local
LLM provisioning, or promises that every browser supports every GPU/media API.

A plugin “backend” initially means its Wasm service in a browser Worker, not an arbitrary remote
server. Long-running optional services belong to a separately authorized personal runtime. There is
no invisible cloud execution behind the word “plugin.”

### Success measures

Treat these as proposed acceptance targets, not measured product results:

- A returning phone user opens an already-installed tool in under one second at p95 on the selected
  reference device after shell readiness, with its state restored.
- Installation presents the real publisher, pinned version, download size, capabilities, and UI trust
  profile before consent. Cancelling leaves no enabled plugin or grants.
- A malicious or broken guest cannot acquire another plugin's host privileges. Revocation prevents
  every subsequent broker operation, including an operation queued before revocation.
- At least one text editor, one network-backed list app, and one canvas app work at 360 CSS pixels.
- No paid provider fallback or unrequested AI work occurs in any failure path.
- Device sleep, connection loss, quota errors, and interrupted updates do not silently discard saved data.

### Language and branding

Use “Apps” or “Tools” in user-facing navigation and “Plugins” in developer/diagnostic screens.
Use “Needs attention” rather than “CrashLoopBackOff.” Keep the Kubernetes analogy in technical docs.
Use the working name PWACloud until a collision/trademark review is completed. Do not imply OpenAI
ownership, certification, endorsement, or that the user's ChatGPT subscription is unlimited.

---

<a id="document-5"></a>

# Source: `docs/01-DECISIONS.md`

## 01. Locked architectural decisions

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

### Version selection

Do not invent “latest” versions in the handoff. M0 must resolve a mutually compatible, maintained set
of Node LTS, pnpm, React/Ionic/router, Vite, Playwright, Rust, wasm-tools, and Jco; run peer-dependency
and smoke tests; then commit exact package versions, lockfiles, compiler toolchain, container digests,
and GitHub Action commit SHAs. Use `docs/REFERENCES.md` as the research baseline. This is a mechanical
compatibility step, not permission to revisit the architecture.

Ionic routing integration must be tested against the chosen React/router pair. Do not mix a current
router with an older Ionic adapter by force-installing peer conflicts. If needed, use Ionic components
with one maintained compatible router and document ownership of transitions/back navigation.

### Important corrections to the early vision

Pasting a repository URL does not make arbitrary source code a plugin. The repository must publish a
PWACloud-compatible release or run the provided publisher workflow. Worker termination bounds a hung
guest best-effort; it is not a browser-wide CPU or memory quota. Iframes and Shadow DOM do not create
universal network isolation. WIT describes interfaces but does not automatically create cross-Worker
RPC or resolve dependencies. A signature authenticates an artifact/signing identity, not its goodness
or source equivalence. A hosted web login is not automatically authorization for plan inference or a
multi-tenant token vault.

The universal UI ABI is the isolated-session protocol, not Web Components alone. Web Components
remain a useful implementation technique, especially for Lit and reusable design elements.

---

<a id="document-6"></a>

# Source: `docs/02-ARCHITECTURE.md`

## 02. System architecture and ownership

### Placement

The PWA owns presentation, local state, installed artifact caches, Worker lifecycles, plugin permissions,
and the broker's local half. A paired personal runtime owns permitted OAuth credentials, authenticated
provider calls, durable AI runs when explicitly authorized, and optional verified network proxying.
The public marketplace holds only public catalogue and release metadata. It never owns end-user
ChatGPT credentials in the default architecture.

Data path: plugin frame -> host-bound MessagePort -> client capability router -> local store, guest
Worker, or same-origin personal API -> authorized provider. Responses follow the same association.
No plugin supplies a replacement API base URL or forwards a provider token.

### Target repository layout

```text
apps/
  shell/                     # React/Ionic installable reference PWA
  personal-runtime/          # Fastify API, OAuth, model adapter, run journal
  catalogue/                 # catalogue compiler and optional search service
packages/
  contracts/                 # schemas and generated TypeScript
  sdk/                       # framework-neutral plugin client
  sdk-react/                 # hooks and React conveniences
  sdk-lit/                   # small Lit example adapter
  ui-kit/                    # phone-first patterns and design tokens
  controller/                # desired state, install transactions, scheduler
  broker/                    # capability policy and authority bindings
  runtime-web/               # Worker loader and Wasm bridge
  runtime-ui/                # iframe creation, handshake, viewport and navigation
  storage/                   # IndexedDB/OPFS adapters and quotas
  provider-chatgpt/           # supported direct-plan adapter
  package-verifier/          # digest, receipts, provenance, compatibility
  registry-client/           # GitHub Release and OCI transports
  cli/                       # create, validate, pack, publish, doctor
examples/plugins/
  notebook/
  feed-reader/
  canvas-board/
tests/
  unit/ integration/ e2e/ hostile/ fixtures/
infra/
  local/ ci/ deployment/
docs/ contracts/ planning/ evidence/
```

Root commands after M1: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`,
`pnpm test:integration`, `pnpm test:e2e`, `pnpm test:security`, `pnpm test:a11y`, `pnpm verify:all`,
and `pnpm verify:release`. A missing script is a failure, not a successful no-op. The seed package's
scripts do not pretend these target commands are already implemented.

### Module boundaries

`contracts` depends on no application package. `broker` is pure policy plus interfaces to storage,
HTTP, identity and provider implementations. `controller` consumes contracts and broker interfaces.
`runtime-web` and `runtime-ui` depend on contracts, not on React. `sdk-react` depends on `sdk`, never
the shell. `ui-kit` provides ergonomic components but is optional for third-party plugin authors.
The personal runtime can run without the catalogue service. The shell can run offline without the
personal runtime. No package imports a concrete application from `apps/`.

Plugin authors must not import shell internals. Enforce dependency rules in CI. The embedding API is
`createPluginHost({storage, policy, registries, uiMounts, aiTransport, diagnostics})`, plus mount adapters.
Ship a minimal second host without Ionic in M9 to prove reusability.

### Runtime principal

A principal consists of host-assigned workspace ID, installed plugin ID, immutable artifact digest,
installation generation, instance ID, and connection ID. Create it only after install validation.
Associate it with the MessagePort or Worker object in a host-side map. A JSON request's fields cannot
replace this association. Grants also bind the account/session generation where AI or remote data
is involved. Uninstall, reload, account switch, and update rotate or invalidate the appropriate generation.

The browser authenticates to its personal runtime using a scoped secure application session, not an
OpenAI token. The runtime independently checks installation/grant/run ownership. An origin or client-side
check alone is insufficient. Do not send a bearer capability valid for arbitrary work to an iframe.

### UI manager

The host owns top-level navigation, header identity, bottom tabs, permission dialogs, confirmations,
and global task controls. A plugin owns its content viewport. It submits navigation intentions and
host-chrome contributions through schemas. It cannot replace the host's account menu or approval sheet.

Keep one active rich iframe on a phone. Replace inactive UIs with durable checkpoints, not dozens of
hidden frames. Host-rendered dashboard previews use sanitized data and host components. Full-screen
plugin pages may internally use any supported bundled web framework. Apps with dynamic CDN imports
must be repackaged for the supported asset profile, not silently given internet/script privileges.

### Guest runtime

A Worker loads a verified component's browser artifact created by the trusted transformation pipeline.
All original imports must match the allowed WIT world. Unknown imports fail before execution. The
loader never runs arbitrary publisher-supplied worker scripts. A guest processes bounded events,
returns effects, and is re-entered when asynchronous effects finish. A wall-clock watchdog terminates
unresponsive Workers; final browser scheduling and process memory are outside platform control.

Workers do not touch the DOM. UI framework Wasm (for example a Rust web frontend) is separate from
service Component Model Wasm and must satisfy the UI bundling/CSP profile. It does not automatically
inherit the service guest's isolation or host ABI.

### Personal runtime

Default bind is loopback. Pairing a phone requires an explicit HTTPS endpoint controlled by the user,
an authenticated pairing ceremony, and the same PWA/API origin. The browser cannot use a desktop's
`127.0.0.1` callback. Complete initial local sign-in on the runtime's computer, then authorize the phone
as a client of that runtime. This is less frictionless than hosted sign-in; the UI must say so.

A paired browser receives only PWACloud session authority. It does not receive OpenAI refresh/access
or ID tokens. Protect local credentials through OS credential storage or an encrypted local store with
a separately protected key. Never treat a desktop configuration file as permission to expose a public
endpoint. A remote VM path remains gated by the documentation/terms issue in `06-OPENAI.md`.

### Durable runs and stream transport

Use HTTP to create a run with an idempotency key and POST body. Return a run ID before streaming.
Stream sequenced PWACloud events using a same-origin authenticated fetch stream. Persist important events
in the runtime journal. The browser acknowledges its last event; reconnect replays events from the
journal, not the model. Never restart a possibly admitted model call just because the phone reconnects.

By default, a disconnect cancels expensive work after a short configured grace interval. A user can
explicitly choose “Continue on my runtime,” with scope, duration and usage limits disclosed. A browser
Worker has no such guarantee. Data and state consistency do not depend on `beforeunload` firing.

### No hidden server dependency

Offline edit/search/filter/format operations remain browser-local. Network-required commands show a
clear offline state. Installation needs internet unless a previously verified package is cached.
AI needs a reachable authorized runtime/provider. Do not queue expensive inference automatically when
a phone returns online. Signed cached metadata is useful offline but cannot prove current revocation status.

---

<a id="document-7"></a>

# Source: `docs/03-MOBILE-UX.md`

## 03. Mobile interaction specification

This is an implementation contract, not a suggestion to build desktop UI first.

### Navigation model

Use four bottom destinations: **Home**, **Library**, **Discover**, **Activity**. Put account, runtime
connection, appearance, storage and privacy in a consistent header Settings action. Do not give every
installed plugin a bottom tab. Plugins appear in Library and as pinned Home shortcuts. In a plugin,
retain host-owned identity/back controls; use a focus mode that reduces chrome without hiding exit,
permission indicators or task cancellation.

Below 600 CSS pixels use one primary content column. From 600 to 959 support optional list/detail
without requiring it. At 960 and above a navigation rail and optional inspector are allowed. These
are product breakpoints. Test landscape and split-screen independently rather than assuming width
alone tells us whether the user has a keyboard.

Each tab retains its own navigation history and scroll position. Back first dismisses a host overlay,
then pops a plugin internal route, then leaves the plugin, then follows application history. Android
system Back and browser Back must agree. iOS edge navigation must not conflict with plugin gestures.
On a dirty form, provide Save, Discard and Cancel through a host-owned confirmation. Never trap the user.

### Shared component contract

Aim for 48 by 48 CSS-pixel primary targets with at least 8 pixels between compact destructive actions.
Use 16-pixel base form text, respect text enlargement, and keep line lengths readable. This chosen
48-pixel target exceeds WCAG 2.2's minimum where applicable; do not mislabel it a universal legal
requirement [S17]. Use system fonts, clear contrast, explicit labels, visible focus, semantic headings,
real buttons and keyboard-operable menus. No functionality is swipe-only, hover-only or drag-only.

Honor `prefers-reduced-motion` and both color schemes. Use a small spacing scale (4/8/12/16/24/32),
consistent corner radii, and minimal ornamental motion. Primary buttons sit near the thumb when this
does not obscure content. Avoid gradient-heavy dashboard decoration, nested cards, tiny permission
badges, and enterprise tables on phones. Cards are for scannable app listings, not every paragraph.

Use `env(safe-area-inset-*)`, dynamic viewport units with fallback, and VisualViewport feature detection.
Virtual keyboard opening must not hide the editor caret, composer, confirmation action or cancellation.
A plugin receives host-derived viewport information, theme tokens, text scale and motion preferences.
It does not calculate account or entitlement state from global CSS or URL parameters.

### S01: welcome and device readiness

Present the value proposition and “Start without an account.” Do not force login to create local notes.
Show “Connect ChatGPT” only with an honest mode description. Demo builds say “Try demo AI” and label
mock output. Local mode offers “Connect to my runtime” with a concise explanation that a personal
computer must host AI requests. Hosted mode stays unavailable until approved; do not draw a working
sign-in button that only returns fake success.

Check secure context, storage availability and minimum required browser features. A missing optional
feature disables only its related action. Offer install guidance after the user has accomplished a
useful action. On iOS use contextual Add to Home Screen instructions; on browsers with install events,
use the browser-supported prompt. Never display a fabricated native install dialog.

### S02: Home

Header: product name, small actual connection indicator, Settings. Content: recent tool, recent saved
items, pinned tools, and one active-task card if work is running. Empty state links to Notebook and
Discover. Offline state is a non-blocking banner. An unavailable AI runtime does not cover the screen
or disable local navigation. Do not show invented statistics, ratings or usage percentages.

### S03: Library

Search installed apps by name and commands. List rows show icon, title, one-line purpose, state and
an accessible menu. Opening a row opens the tool, not its settings. Manage opens a detail sheet or
page with version, permissions, storage, publisher, update status, disable and uninstall.
Show “Paused to save memory” for an intentionally unloaded app, not a failure badge.

### S04: Discover

Search field at top, curated categories and compact app rows. A category tap filters instead of
opening stacked navigation levels. Display only real catalogue data. Separate “works on this device,”
“needs connection,” and “not compatible” states. Include “Install from repository” as a visible action
with a paste-friendly field and an example format. Clipboard reading happens only on explicit input
and browser permission; never read it automatically on launch.

### S05: app details

Include publisher/repository, pinned release, last published date, package size, UI isolation profile,
required versus optional capabilities, screenshots from the real version, license, source/provenance
badges with precise definitions, compatible host API, and a clear Install button. Screenshots require
alt text. Permission explanations must be specific: “Read documents you select,” not “Access files.”
No “verified safe” badge. A cryptographic signature is not a safety review.

### S06: repository resolution and install

Keep the flow to four intelligible steps: Resolve, Review, Download, Ready. The review sheet identifies
the canonical repository and release digest. Show changed permissions for an update. Do not use a
spinner indefinitely. Surface rate limit, no compatible release, bad signature, incompatible API,
insufficient storage and offline as distinct recoverable states. Cancelling mid-download removes
staging state and grants; an existing installed version remains untouched.

### S07: permission sheet

The host owns this UI outside plugin frames. Separate required grants from optional grants. Denied
optional grants do not prevent installation. Explain the consequences of denying a required grant.
AI access includes context scope, responsible provider/account label, plugin request cap, cancellation,
and whether explicitly authorized background operation is available. The profile warning for arbitrary
web UI must not imply perfect network confinement. Do not overwhelm users with WIT names or raw JSON.

A sensitive action confirmation states the exact object and operation, such as “Allow Canvas Board to
read this note once?” Approval binds the resource, plugin, run, generation and expiry. “Approve all
future actions” is not the default. Return focus to the invoking control after closing.

### S08: plugin content viewport

A plugin owns a real responsive app, not a small dashboard card. Notebook has a full-height editor,
a formatting row, document picker, and AI panel as a full-page or bottom-sheet route. Feed Reader has
virtualized feed rows and readable article detail. Canvas Board uses one-finger tool selection and
explicit pan/zoom modes; provide a non-drag alternative for moving objects.

At 360 pixels, a desktop split view becomes routes or segment controls. Never shrink three desktop
panes into unreadable columns. Frames use a single intentional scroll container. Avoid scroll traps,
double overscroll, lost text selection and repeated remounting during streaming. Floating controls
must not cover the last editor lines. Plugin overlays must remain inside their viewport or request
host-owned overlays through a safe API.

### S09: AI composer and task controls

Show the provider label and selected model display name from the actual catalogue. Display the data
scope before sending. Use explicit Send, Stop and Retry. During a stream, preserve scroll when the
user reads earlier text and offer a jump-to-latest button. Partial output survives a disconnect as
partial output, never relabeled a completed answer. Errors distinguish access unavailable, consent
missing, rate limit, interrupted transport, incompatible feature and unavailable personal runtime.

Use a first-use plan-usage notice consistent with provider guidance, not on every login [S08]. Do not
promise extra ChatGPT allowance. Local request counts are labeled as PWACloud's counts; unknown
provider limits remain unknown. Account switching cancels or isolates active runs and clears visible
private state before rendering another account's data.

### S10: Activity

A chronological list of tasks with plugin, action, start time, state and Stop when relevant. Tap for
redacted events, selected inputs, outputs and retry controls. Distinguish browser-local work from work
continuing on the personal runtime. Show queued consent as “Needs approval.” On reconnect, join the
existing run ID and event cursor. Never submit another billable request just to rebuild the UI.

### S11: settings and usage

Sections: Appearance, Runtime & ChatGPT, App permissions, Storage & export, Updates, Privacy, Diagnostics.
Provide a prominent disconnect/revoke flow. Local session sign-out and provider revocation are different
operations; reflect actual results. Export prompts warn about included private content. Diagnostic
exports redact prompts and tokens by default and require explicit user action.

### S12: update and recovery

An update sheet lists version, publisher, capability changes and data-migration implications. Do not
reload during an edit or active task. Save, pause, apply, restore. A failed plugin update restores the
previous artifact only when its data remains compatible; otherwise restore the pre-migration snapshot
or present recovery choices. Uninstall separately asks whether to retain data and export it first.

### Accessibility and device proof

Test keyboard navigation, VoiceOver on an actual iPhone, TalkBack on an actual Android, zoomed text,
reduced motion and dark mode. Verify accessible names inside frames as well as host chrome. Avoid
asserting automated accessibility checks prove conformance. `planning/acceptance-cases.json` includes
required manual/device cases and the exact evidence fields.

---

<a id="document-8"></a>

# Source: `docs/04-PLUGIN-PACKAGE.md`

## 04. Plugin package specification, v0.1

The machine-readable manifest is `contracts/plugin-manifest.schema.json`. JSON is normative for the
release artifact; a publisher CLI may accept YAML and normalize it before signing. Use strict unknown-
field rejection and size limits. Do not reinterpret a manifest with arbitrary executable hooks.

### Package contents

A distribution archive contains `manifest.json`, `ui/app.js` and `ui/style.css` when applicable,
`service/component.wasm` when applicable, verified asset files, license notices, and a machine-readable
build report. The package cannot contain symlinks, hardlinks, device files, absolute paths, traversal,
NUL characters, duplicate normalized entries, encrypted entries or nested executable archives.
Enforce compressed bytes, expanded bytes, file count and individual-file budgets before extraction.

A separate release envelope binds archive digest and size, manifest digest, component-world version,
source repository identity and commit, package version, browser-transform toolchain identity, and
signature/provenance references. Do not include an archive's own final digest inside that archive.
The envelope is signed over exact bytes. Verification must not depend on reserializing JSON identically.

### Manifest semantics

`id` is a publisher-scoped immutable identifier. Names, icons and screenshots are display metadata,
not authority. `version` is strict SemVer. `hostApi` specifies the supported major and tested minimum
minor. `ui.profile` chooses `isolated-web` or `host-rendered`; a manifest cannot request first-party
host execution. The `service` is optional, but at least one UI or service contribution is required.
Host API and component world versions are distinct and cannot be substituted for each other.

Permissions have stable IDs, a capability name, a required flag, and structured restrictions. Network
scopes use exact HTTPS origins, method allowlists and normalized path prefixes. No arbitrary wildcard
hostnames in v1. Storage is per-plugin and workspace; a quota does not reserve disk. AI is a named
capability with local admission limits and declared context scope, never a credential or entitlement.
Unknown capabilities are incompatible, not automatically granted.

Contributions are declarative host chrome: library entry, route suffix, command, settings entry,
and optional host-rendered preview. Paths are namespaced under `/apps/<installation-id>/...` by the
host. A plugin cannot register `/auth`, `/settings`, global account controls, arbitrary HTML icons,
raw SVG scripts, or a service worker. Use a host-reviewed icon identifier or inert vetted image.

### Expressive UI asset profile

V1 isolated-web UI publishes one bundled IIFE JavaScript entry, one CSS entry, and an asset map. All
framework dependencies are included; no remote scripts, fonts, analytics, dynamic CDN imports or
runtime package installation. The bundler rewrites asset references to SDK-provided object URLs.
Map token-to-file digest before serving an asset. Dynamic chunks are flattened or rejected for this
profile. Large lazy applications can add a separately versioned module-loader profile later.

The host constructs a controlled `srcdoc` document containing only the verified bundle and runtime
bootstrap. Escape embedded script/style termination safely using encoded payloads, not a string
replacement with unproven edge cases. Restrict scripts and resources with CSP and sandbox. See
`05-SECURITY.md` for the residual navigation risk. Asset bytes come from the host's verified cache,
not cross-origin third-party storage. This profile intentionally trades some bundler convenience
for predictable offline behavior and an auditable load boundary.

M0 must prove this packaging path with React and Lit in real browser engines. Do not ship a loader
that works only with WebKit security disabled. Rust/.NET UI frameworks are future compatible candidates
only after their output meets the profile and size budget; they are not automatically supported in v1.

### Wasm transformation

Publish the original component and transform it with a pinned trusted Jco pipeline [S12,S13]. Reject
unknown WIT imports, unapproved runtime features, missing memory maxima where policy requires them,
and components exceeding aggregate declared linear-memory policy. Inspect all embedded core modules.
JavaScript glue in the package is not inherently safe because it accompanies Wasm. Only the pinned
transform pipeline may generate executable Worker glue; verify provenance and/or repeat transformation
in the verifier. Do not import a publisher's free-form Worker entry.

Browser linear memory limits do not bound JS heap, compiled code, GPU allocations, all runtime overhead,
or the full page's memory. Label these controls accurately. First guests use synchronous event handlers
that emit async effects; no browser-wide shared memory or cross-origin isolation is required for v1.

### Signatures and trust roots

Use Sigstore/Cosign in publisher CI to establish a specific expected workflow identity and issuer,
not merely “signed by some GitHub Actions job” [S15]. The personal verifier checks that identity,
source/release relationship, artifact digest and expected builder. A signature does not establish
independent reproducibility. Display those badges separately.

For browser/offline use, issue a compact PWACloud verification receipt signed by a catalogue/verifier
key trusted by the host. Prefer WebCrypto-compatible ECDSA P-256 with specified raw 64-byte `r||s`
encoding. Version the format and sign an exact byte payload. A receipt binds manifest/package digests,
publisher identity, verification policy version, expiry and revocation-feed version. The browser checks
the receipt and hashes downloaded bytes itself. This makes the receipt issuer an explicit trust root;
do not hide that dependency or call it trustless.

Direct repository installs follow the same verification pipeline, plus a visible first-use publisher
trust review. An arbitrary key supplied by the plugin is not a trust anchor. A self-host operator can
configure private trust roots explicitly. Production roots are never replaced by the test fixture key.

### Install compatibility and dependency rules

Resolve versions into a lock record with immutable digest, source commit, host API, guest world,
UI profile and chosen service bindings. Resolve the entire dependency graph before installation;
reject cycles and unsupported major versions. Optional dependencies do not silently auto-install.
Two independently upgraded providers may coexist only if the namespaced service binding and data
ownership remain unambiguous. No global JS dependency sharing between untrusted UIs.

Offline installs require an already cached valid receipt and package. Expired receipts block new
installation until reverified. Already-installed tools can remain locally usable with an explicit
revocation-freshness warning under policy; sensitive new operations can require current trust metadata.
Updates that add permissions always require fresh consent before activation.

---

<a id="document-9"></a>

# Source: `docs/05-SECURITY.md`

## 05. Threat model and release-critical security requirements

### Protect these assets

The user's local documents, plugin-private stores, host sessions, ChatGPT credentials and entitlement,
other provider credentials, selected account/workspace identity, install trust roots, grant decisions,
AI usage, saved work, and the ability to leave or stop a malfunctioning plugin.

Assume a malicious plugin publisher, compromised release/CDN, dishonest manifest, hostile web UI,
malformed Wasm, prompt injection in retrieved content, forged RPC messages, revoked permission races,
network redirects/DNS rebinding, interrupted browser storage writes, and another tab resuming stale state.
Also assume publisher CI dependencies may be compromised. Do not assume signatures eliminate malice.

### Trust classes

`host-rendered` executes untrusted service logic only as Wasm and renders through audited host
components. It is the recommended class for strict data-handling requirements. Rich custom web UI
is not allowed in this class.

`isolated-web` runs bundled untrusted JavaScript inside an opaque-origin iframe. It protects host DOM
and privileged capability boundaries when correctly implemented. It does **not** provide a complete
CPU, memory, or outbound-network isolation guarantee. Its UI can see data the user deliberately sends
to it. Do not load secrets or arbitrary workspace content by default.

First-party host UI is compiled into the shell and reviewed as trusted application code. A marketplace
plugin cannot promote itself into that class. No “trust this plugin” toggle that silently loads its
JavaScript alongside the host's session authority.

### Frame setup and residual egress

Use `sandbox="allow-scripts"` with no same-origin, forms, popups, downloads, top-navigation or modal
permissions. Apply a restrictive CSP to the actual controlled document: default none; connect none;
object none; frame none; base none; form-action none; worker none; scripts only the pinned bootstrap/
verified bundle mechanism; images/fonts/media only vetted local blob/data resources as required.
Use a restrictive Permissions Policy and no-referrer. Do not rely on the experimental iframe `csp`
attribute as the only enforcement mechanism [S14,S16,S19].

The frame's `fetch`, WebSocket and similar direct resource requests should be blocked by CSP. However,
self-navigation can be a residual outbound channel, and arbitrary JavaScript can create other device/
browser-specific behaviors. `connect-src` is not a universal network firewall. A load handler can tear
down a navigated frame and revoke its port, but cannot undo a request already sent. Cross-browser
no-egress claims require stronger architecture, not optimistic wording. Do not pass highly sensitive
information into arbitrary custom UI under a “cannot send data out” promise.

On any unexpected navigation, revoke the old port and grant generation; require verified reconstruction
before reconnecting. Never reuse the old session nonce. A frame could also stall the page process;
removing it is not a guaranteed OS-level kill. Document the DoS limit and prioritize reviewed marketplace
apps. Service guests have better termination control because they run in Workers.

### Handshake and RPC

Create a random single-use boot nonce tied to a specific iframe instance and installation generation.
Verify `event.source === iframe.contentWindow`. An opaque frame's origin can be `null`, which is not
identity. A one-time port-transfer handshake may need wildcard target origin for an opaque origin;
never use a global wildcard listener for privileged operations. After setup, use the bound MessagePort
only. Verify version, instance generation, message size, request ID, method schema and expiry.

The host map owns the principal. Ignore or reject any principal fields in plugin packets. Close the
port on reload, disable, uninstall, account switch, unexpected navigation or repeated protocol failures.
Bound in-flight RPCs, queued bytes, payload sizes, stream windows and response rates. Drop stale
responses after teardown. Reject duplicate/replayed request IDs except documented idempotent retries.

### Grant evaluation

Authorize each operation, not just installation. Evaluate the authenticated user/session, current
workspace, active install digest/generation, requested resource, granted scope, provider/account,
expiry, revocation counter, user gesture or action approval, and usage admission. A denied dependency
cannot tunnel through another plugin's more powerful grant. Cross-plugin calls carry both caller and
callee context; effective authority is the explicit approved binding, not the union of their grants.

Queueing before revocation is not permission to execute after revocation. Resource handles are opaque,
scoped, expiring and revocable. A file picker grants the selected file, not all browser/local storage.
Sensitive approve dialogs are always outside untrusted frames.

### Network broker and SSRF

Browser-direct host fetch still obeys CORS [S20]. A personal-runtime proxy is not a CORS bypass service
for arbitrary URLs. Enforce exact permitted origins, methods and path scopes. Reject credentials in
URLs, ambiguous encodings, unexpected protocols, host suffix tricks and unapproved ports. Restrict
headers, request sizes, content types, response bytes, duration, decompression expansion and concurrency.
Use `redirect: manual` and validate every redirect target; do not forward credentials across origins.

Server-side fetching also requires DNS resolution and connection-time address validation. Block
loopback, private, link-local, multicast, metadata services, IPv4-mapped IPv6 and disallowed ranges
unless a separately designed local-service capability authorizes them. Pin the resolved allowed address
for the actual connection, verify the peer, and re-check each hop. URL string validation alone is not
SSRF protection. Treat catalogue, package and screenshot fetchers as SSRF surfaces too. Keep network
credential injection bound to an exact provider audience and redacted from plugin-visible responses.

### Session and credential protection

Use a host-only `__Host-` secure HttpOnly application cookie with an intentional SameSite policy,
CSRF token and exact Origin validation. Reject `Origin: null` for authenticated APIs. Check Fetch
Metadata where available as defense in depth, not the only auth. Do not accept a CORS wildcard with
credentials. Do not put application-session authority in iframe URLs. OAuth callbacks use validated
transaction state and separate exemptions, not a global CSRF disable.

The OpenAI credential rules and external approval gates are in `06-OPENAI.md`. A secure key vault
cannot make an otherwise unauthorized custody model permissible. Do not store tokens simply because
an earlier design diagram showed a BFF. Credential-free static hosting remains possible for the shell.

### Supply chain and content

Verify immutable bytes before parsing executable payloads. Enforce archive limits before extraction.
Use an ephemeral isolated publisher build without customer secrets, host filesystem mounts, Docker
socket access or inherited cloud credentials. Do not build arbitrary repositories on catalogue workers.
Trusted workflows pin actions/toolchains and emit SBOM, license and provenance data. Dependency updates
run the whole hostile-plugin suite. Disable install-time hooks for third-party packages where feasible;
review any necessary build script explicitly.

Render Markdown/HTML with an allowlist sanitizer and safe link handling. Sanitize SVG or use rasterized
icons for catalogue metadata. Prevent stored XSS in titles, errors, logs, file names and AI output.
A model tool call is a request, not permission. Prompt-injected content cannot broaden grants, switch
accounts, alter budgets, invoke shell, or turn on background runs.

### Failure handling and incident response

Fail closed on verification and authorization errors. Preserve user data. Record redacted structured
security events with reason codes and plugin digest. Publish a revocation feed for compromised releases;
apply it without deleting documents. Document stale/offline trust behavior. A recovery control can
start the shell with all plugins disabled. Never treat revocation-feed silence as proof of safety.

### Security tests are release gates

Required attacks include forged principal, null-origin API call, wrong MessagePort, replay after reload,
credential read, host DOM read, blocked direct fetch/image/WebSocket, frame self-navigation residual,
SSRF redirect, mapped IPv6, oversized decompression, memory-growth guest, endless Wasm loop, UI DoS,
prompt-injected tool invocation, permission expansion update, downgrade, signature mismatch and
provider usage after revocation. The residual tests document remaining limits; they must not be renamed
as successful containment claims. See `12-TESTING.md` for evidence and expected outcomes.

---

<a id="document-10"></a>

# Source: `docs/06-OPENAI.md`

## 06. OpenAI identity and ChatGPT-plan integration

Research date: **2026-10-01**. This file supersedes any earlier assumption that a public PWA can
store everyone's ChatGPT tokens on a shared backend. Sources S01-S08 and S21-S25 are primary OpenAI
documentation. Recheck before public release; this is a changing preview and not legal advice.

### Verified capability and the product boundary

OpenAI documents Sign in with ChatGPT, optional eligible plan usage, an OSS/local flow and selected
commercial access. Identity does not itself confer inference entitlement. A publicly licensed project
is not automatically an approved hosted service. Register the real application, PWACloud, not another
tool's client identity. Use only the documented public Responses endpoint [S01,S02,S03].

### Required deployment modes

| Mode | User experience | Credential placement | Release status |
|---|---|---|---|
| `demo` | Full local app and clearly marked synthetic AI | No provider credentials | Fully implement |
| `chatgpt-plan-local` | User signs in on their personal runtime computer; phone pairs securely | Permitted protected local user-controlled store | Implement and test with authorized sign-in |
| `approved-hosted` | Direct mobile website sign-in | Only the custody model actually approved for this integration | Implement adapter boundary, keep disabled pending approval |
| `self-hosted-vm` | User-managed remote runtime | Unresolved documentation/terms interaction | Block persistent token deployment pending clarification |

The default local integration must remain free to use. Do not make “enter an API key” the primary
success path. Optional separately billed API support may be added after explicit user selection; no
automatic fallback and no API account required for the reference ChatGPT-plan path.

### Terms and documentation tension: fail closed

The SIWC terms dated September 29, 2026 constrain persistent token storage, user-controlled execution,
connected-app scope, charging for plan access, and subscription sharing. The separate self-hosted-VM
guide describes transferring credentials to a personal VM, while the session guide mentions protected
self-hosted storage. Those texts are not fully aligned on persistence. Do not resolve this silently
in favor of a multi-tenant vault or VM implementation [S04,S05,S06].

Default to protected storage on the user's local runtime. Obtain clarification or applicable written
partner terms before enabling hosted/remote persistent credentials. Also obtain confirmation that
third-party plugins installed inside PWACloud fall within the connected application's permitted scope.
Do not expose a generally reusable OpenAI-compatible proxy to other applications. Treat these as
external go-live gates, not evidence that a request has already been approved.

### Separate identity, entitlement and grants

PWA identity says which workspace/session is active. Provider registration says which verified
OpenAI issuer, subject, client registration and workspace is selected. Entitlement says which actually
granted scopes/features are available. Plugin grants say what that installed plugin may request.
All four must be valid before inference. Never merge accounts by email, infer a Pro plan from a label,
or let a plugin choose a different account. Provider usage is for this authenticated user's work.

Maintain explicit states: disconnected, identity-only, needs-consent, connecting, ready, refreshing,
reauth-required, temporarily-unavailable, policy-blocked and disabled. A failed refresh is not permission
to create a new account or rotate host IDs. UI state reflects verified responses, not a static demo flag.

### Local OSS registration

Use the documented registration flow with fresh state, nonce and PKCE S256, a stable opaque
`ext_agent_host_id`, and the application's actual name. First registration starts with
`dynamic_agent_client`; the issued client ID returned for that registration is saved and used for
exchange/returning authorization. Validate returned identity and granted scopes; retain identity-only
state when plan permission is absent [S07].

Implementation tasks: loopback listener with exact callback path; one-time expiring transaction;
issuer/JWKS verification; audience and nonce checks; state consumption; secure credential persistence;
refresh serialization; explicit account selection; redaction; and cancellation. Use a maintained OIDC
library where compatible. Derive exact endpoints and scope set from the referenced official flow at
implementation time. Never invent a device-code flow or copy another tool's auth file.

A phone cannot complete an OAuth callback on a different computer's `127.0.0.1`. In local mode the
computer completes sign-in and displays a short-lived one-use pairing invitation. The phone pairs to
the runtime's authenticated HTTPS PWA origin. Pairing grants a PWACloud session, not provider tokens.
Protect pairing with entropy, expiry, attempt limits, account confirmation on the runtime, and no
credential-bearing QR URLs. A pairing code is transient authority and must be redacted like a secret.

### Hosted identity

The website integration requires its own registered client/callback and the documented OIDC/PKCE
transaction flow. This identity route is distinct from OSS dynamic plan registration [S21]. Do not
assume that `openid profile email` also grants inference or that the OSS loopback callback works as
a hosted redirect. Hosted plan usage needs its applicable approved configuration. A config boolean
alone is not proof of approval; record operator-controlled release evidence separately.

### Plan adapter request shaping

The adapter obtains the selected account's available model list and preserves provider display names
and slugs. Do not hardcode the conversational model named in an example. This route's documented
catalogue uses a `models` array, which differs from assumptions some generic API clients make [S03].
Use the selected slug and the documented Responses HTTP transport. The small reference request builder
in `src/reference/ai.ts` intentionally supports only text, context and instructions.

For the current plan route, construct `store: false`, `stream: true` and the required history as `input`.
Do not forward arbitrary JSON from plugins. Omit unsupported generation options, persistent continuation
fields and hosted tools. In particular, do not implement local output budgets by sending unsupported
`max_output_tokens`. Image generation, hosted file search, Code Interpreter, native computer use and
hosted MCP are not v1 promises for this route [S22].

Images/files, structured outputs and tool calls require explicit adapter capability validation for the
selected model. Text is the first verified path. An unsupported capability produces a typed error before
request admission. A plugin's “AI” manifest permission is not a claim that every API endpoint is covered.

### Tool and agent bridge

After text streaming works, expose only plugin tools the user granted and the adapter supports.
Namespace tools by stable plugin and command IDs. Validate schemas, principal, resource scope, run
approval and data disclosure for every call. Model instructions never override broker policy.
Local function/custom execution is distinct from hosted provider tools. An optional Codex app-server
integration belongs to a later personal-runtime module, not the phone or mandatory UI runtime [S23].
Do not ship shell access in the first three plugins.

### Run accounting and limits

Use admission reservations per account, workspace and plugin. Local caps govern requests, concurrent
runs, input bytes, output delivery bytes and elapsed time. They are not exact ChatGPT credit forecasts.
Provider counters, when available, remain authoritative for provider usage. Show unknown remaining
allowance as unknown. The user's per-app provider limit is distinct from our per-plugin controls [S24].

Reserve a slot before sending, release the in-flight slot when finished, and retain the admitted-request
count even when a stream fails. Do not treat cancellation as a refund. Exact inference cost ceilings
cannot be promised from client cancellation or unsupported output parameters. Once request acceptance
is uncertain, retry only with a known safe idempotency strategy or explicit user action.

### Streaming, interruption and refresh

The runtime parses SSE incrementally across chunk boundaries, including UTF-8 and partial JSON. Track
provider request IDs privately, normalize events with monotonically increasing local sequence numbers,
and persist resumable run state. A disconnected HTTP stream is not completed inference; require a
provider terminal event. Reconnect the phone to the existing local run journal, not `previous_response_id`
on a fresh unsupported plan request. Sanitize provider error text and preserve diagnostic status/code.

Handle identity-only, revoked access, admission failure, policy restriction, rate limit and temporary
routing failure separately. OpenAI documents several different error shapes; do not assume every error
has the usual API object. Never silently switch billing paths [S25]. Serialize refresh per registration,
atomically replace credentials, and prevent concurrent refresh races from overwriting newer tokens.

### Consent and privacy

User-generated work can consume usage only after provider entitlement and plugin consent. Background
work requires a separate explicit decision, a stopping condition and visible activity. No automatic
AI requests during app launch, background catalogue refresh, installation, analytics or screenshots.
Approval copy must identify which data leaves the device. Do not claim login imports ChatGPT history.
Delete or export local PWACloud conversations under the user's control.

### Tests and external gate

Protocol fixtures must test missing direct-use scope, wrong state/nonce/issuer/audience, reused code,
expired transaction, wrong account, refresh race, revoked access, unsupported parameters, unknown model,
stream truncation, cancellation, duplicate run creation, policy denial and no fallback. These fixtures
prove our code, not provider eligibility.

A real smoke test requires the owner to authorize a real eligible account, enumerate actual models,
complete a short request and cancellation, and retain redacted evidence with no tokens or personal
prompts. Missing sign-in remains `blocked`, not `passed`. The hosted release additionally requires the
approval/custody/plugin-scope gates. Local and non-AI implementation continues while those are pending.

---

<a id="document-11"></a>

# Source: `docs/07-LIFECYCLE.md`

## 07. Install transactions, reconciliation and recovery

### Durable model

Persist desired state and generations, not live Worker handles. An installation is scoped to a workspace.
`desiredVersion` resolves to an immutable artifact digest before activation. Runtime instances are ephemeral.
Use states: absent, resolving, awaiting-consent, downloading, verifying, staged, ready, starting, running,
suspended, degraded, backoff, updating, quarantined, disabled, uninstalling, recovery-required.

The UI can collapse technical states into “Installing,” “Ready,” “Paused,” and “Needs attention,” but
logs retain exact states and reasons. Persist each critical transition with a monotonically increasing
revision. Transition code uses compare-and-swap or a transaction so two tabs do not activate different versions.

### Installation transaction

1. Normalize supported repository input. Fetch metadata without executing source.
2. Resolve a release and manifest; freeze its exact digest and source identity.
3. Validate compatibility, quotas, UI profile, archive limits and dependency graph.
4. Verify provenance/signatures/receipt. Display the verified identity and requested permissions.
5. Collect consent. Missing optional grants stay absent; declined required grants stop activation.
6. Download and hash into a staging namespace. Verify all entry hashes and sizes.
7. Write the immutable verified package and grant set to durable local stores.
8. Commit the installation pointer, manifest digest and generation atomically.
9. Start only when requested or needed for a bounded approved task.

Downloads may happen before consent only if no execution or sensitive access occurs and this is disclosed.
No grants or enabled installation survive cancellation. An incomplete staging directory is garbage-collected
on the next foreground reconciliation. OPFS and IndexedDB do not share one transaction; bridge them with
a journal and a pointer-commit protocol, not an imaginary cross-store transaction.

### Startup and scheduling

Reconcile on app boot, foreground/resume, desired-state mutation, task admission, dependency change,
worker exit and trust-feed update. Avoid polling healthy inactive apps. On a phone permit one active
rich frame and two active service Workers by default; schedule additional jobs in a fair bounded queue.
A specific user-visible long task can request a larger budget after consent. Browser capabilities and
measured pressure can reduce concurrency. Do not rely on nonportable memory metrics as the only safety signal.

A healthy idle instance can be snapshotted and terminated. An installed plugin does not need a running
instance. `enabled` means eligible to start, not “keep process alive.” Persist UI route/document state
before suspending; respect the fact that sudden OS termination may happen without a final callback.

### Health and hangs

Service initialization, event calls and heartbeats use separate deadlines. Background-tab throttling
must not create restart loops. On resume, compare last-known state and recreate stale instances rather
than counting every elapsed heartbeat as a crash. Use exponential backoff with bounded jitter and a
rolling crash count. Quarantine repeat crashes with a user-readable reason and reset option.

Terminate the Worker when a guest exceeds its wall-clock budget; discard its MessagePorts and pending
responses. Retrying a pure formatting call can be automatic within a small bound. Replaying an external
write or admitted AI request cannot. Use operation IDs and explicit completion records.

### Update policy

Default to notify-and-apply when inactive, not arbitrary background auto-update. A release without new
grants may be staged automatically; activation still waits for a safe point. An expanded grant set or
changed UI trust profile requires consent. Signature or publisher changes require explicit review.
Preserve the previous package until the update's data compatibility and smoke tests pass.

A staged update has its own generation, migration plan and journal. Pause old work, snapshot relevant
data, perform versioned migrations, run a bounded health check, then atomically switch the active pointer.
Migration code runs without network/AI grants. Avoid in-place destructive migrations. Prefer additive
schemas with old/new read compatibility; declare the compatible rollback window.

### Rollback and data safety

Code rollback is not automatically data rollback. Store a pre-migration snapshot or a reversible,
verified migration path. If the old artifact cannot read the new data, do not point it at that data.
Use the snapshot or enter recovery-required with export/recovery options. Keep actual user edits made
after the snapshot in a separate recovery record when possible. Never silently discard them.

A malicious downgrade cannot bypass current host minimum versions, signature policy or revoked-digest
rules. Rollback is permitted only to a verified allowed version. The user should see why a rollback
is blocked rather than a generic “failed” toast.

### Disable, revoke and uninstall

Revocation invalidates grants immediately, aborts broker work where possible, and prevents queued work
from starting. It cannot retract data already sent or guarantee a provider refund. Disable stops runtime
instances and retains data. Uninstall invalidates all sessions and contributions, closes frames/Workers,
removes the install pointer and offers retain/export/delete data. Cleanup is idempotent after interruption.
Shared cache objects can be deleted only when no installation or rollback reference uses them.

### Multitab and offline operation

Use a leader lease with fencing/revision checks for install and migration work. BroadcastChannel can
notify peers, but durable revision checks provide correctness even when broadcasts are missed. Web Locks
may improve coordination where available; retain a transaction-backed lease fallback. UI sessions can
remain separate, but no duplicated external effect is permitted merely because two tabs are open.

Offline, load verified cached packages, keep local editing available, and expose trust freshness.
Never enable new permissions based on expired metadata. If storage is evicted, show a recoverable empty
state, restore from explicit backups where available, and do not invent missing data.

---

<a id="document-12"></a>

# Source: `docs/08-SDK-RPC.md`

## 08. SDK, guest ABI and service contracts

### SDK surface

`@pwacloud/sdk` is a thin typed transport client, not a source of authority. It exposes promises and
async iterables to UI authors while the host controls the underlying MessagePort. The source package
scope is a target naming convention; verify registry availability before publishing it.

```ts
interface PluginClient {
  storage: { get(key: string): Promise<Uint8Array | null>;
             put(key: string, value: Uint8Array): Promise<void> };
  http: { request(request: ScopedHttpRequest): Promise<ScopedHttpResponse> };
  ai: { start(request: AiTaskRequest): Promise<{ runId: string }>;
        events(runId: string, after?: number): AsyncIterable<RunEvent>;
        cancel(runId: string): Promise<void> };
  commands: { invoke(id: string, args: unknown): Promise<unknown> };
  ui: { navigate(path: string): Promise<void>;
        setTitle(title: string): Promise<void>;
        checkpoint(state: unknown): Promise<void> };
}
```

These are proposed interfaces; generate final binding types from the versioned schemas. SDK initialization
requires a host handshake; do not expose a global API that any random window can attach to. React hooks
subscribe to state without remounting on every stream chunk. Lit gets an adapter using the same protocol.

### Protocol envelope

Use version, request ID, method and params only for requests. The transport already supplies principal.
Responses contain request ID, success/error and a typed payload. The SDK maps `ai.events()` to a
permission-checked `ai.subscribe` request and sends `ai.unsubscribe` on disposal; it does not hand
the iframe an authenticated HTTP endpoint or session cookie. Events contain channel/run ID, sequence,
type and data. The receiver validates unknown fields, maximum encoded bytes and method-specific schema.
Use structured clone and Transferables for binary payloads, not unbounded base64 blobs in JSON.

Errors have stable codes such as permission-denied, revoked, incompatible, quota-exceeded, offline,
provider-unavailable, unsupported-capability, cancelled, timeout, invalid-request, interrupted and internal.
Human messages are sanitized. Stack traces, secrets and raw provider headers are not plugin-visible.

Set initial bounds: 256 KiB control message, 64 outstanding RPCs per frame, 8 MiB binary transfer with
explicit credit, bounded event queues, and 30-second generic request timeout unless a method defines
something narrower. These are proposed v1 policy defaults. Streaming is not one ever-growing response.

### Navigation and design context

A host sends initial theme tokens, locale, text scale, safe-area/viewport context, current route and
restored checkpoint. Context updates are sequenced and coalesced. A plugin requests route changes
under its namespace; the host updates browser history and sends a confirmed route event. The host owns
back-stack order and route persistence. Do not use `window.top.location` from plugin code.

For privileged browser features that require user activation, the SDK requests a host interaction flow.
A MessagePort callback may not preserve transient activation. Use a host-owned button/chooser when
necessary and test it on devices. Do not promise camera, clipboard, share or file access by merely
adding a manifest string.

### Event/effect Wasm ABI

`contracts/plugin.wit` defines the versioned guest world. Guest exports activation, event handling,
snapshot and shutdown. Event handling is synchronous and bounded; asynchronous work returns effects
such as storage-get, network-request or AI-start with correlation IDs. The host checks grants, performs
the async operation, and returns an effect-result event. This avoids blocking a browser thread to emulate
synchronous HTTP imports. No Asyncify or experimental async Component Model feature is required in v1.

The TypeScript side validates a guest's returned effect list before executing it. Limit effects per
turn, aggregate payload, recursive call depth and outstanding operations. Deny cycles that continually
create new effects without user-approved budget. A guest is not allowed to bootstrap its own Worker or
create privileged JS closures. Re-entrant host callbacks must queue events, not corrupt guest state.

WIT gives typed call boundaries, but service discovery and transport still need implementation [S12].
For plugin-to-plugin services, generate TypeScript adapters for supported WIT interfaces and route
through the broker. Bind consumer/provider identities, version, scope and resource handles explicitly.
No raw direct port is handed to a peer if that would bypass policy.

### Agent tools

A tool descriptor contains stable ID, input/output schemas, description, read/write classification,
resource-selection semantics, required grants and confirmation rules. Descriptions supplied by plugins
are untrusted content, not system instructions. The host builds the available tool list from current
grants and supported provider capabilities. Sensitive writes require confirmation bound to exact arguments.
The agent cannot install plugins or authorize another plugin on the user's behalf without an explicit
host-controlled approval flow. Shell execution is outside v1.

### API endpoints on the personal runtime

The proposed contract in `contracts/openapi.json` covers session status, provider state/models, install
metadata, run creation/events/cancel and scoped network requests. Every resource checks session and
ownership server-side. Request IDs are idempotency keys scoped to user/plugin, not global strings.
Do not expose raw OpenAI request passthrough, arbitrary model endpoint URLs, credential export, or a
catch-all “execute” route. The public catalogue has a separate read-only surface without user sessions.

---

<a id="document-13"></a>

# Source: `docs/09-MARKETPLACE.md`

## 09. Git-to-install distribution and marketplace

### Publish once, install without rebuilding the host

The plugin author runs a scaffold command, develops locally against the SDK, validates the package,
and publishes a signed release from their own repository. A user pastes the repository URL or selects
its catalogue entry. The host resolves a verified immutable release, not a branch's live JavaScript.
Repositories lacking the manifest or compatible release receive an actionable error and authoring guide.
Do not compile unknown repositories inside the user's phone or automatically send their source to a build service.

CLI target commands: `pwacloud create-plugin`, `dev`, `validate`, `build`, `pack`, `verify`, `publish`,
`doctor`, and `inspect`. `publish` requires the author's authorized credentials and cannot silently make
a private repository public. The scaffold includes React and Lit UI choices and an optional Rust service.

### Release pipeline

Validate source manifest -> compile guest -> bundle UI -> inspect imports/limits -> schema/contract tests
-> browser smoke tests -> licence/SBOM -> deterministic archive -> digest envelope -> sign -> publish.
Source builds run with no end-user credentials. Signing permissions exist only in a protected release job.
Fork PR tests do not get write tokens or OIDC signing authority. A tag must refer to a reviewed commit.
Use an explicit source-to-artifact relationship and label “attested” separately from “reproduced.”

GitHub Releases is the first transport. Support an immutable envelope referencing release assets with
exact digests. Never assume redirected release URLs are permanent or that an OCI registry allows browser
CORS. The personal resolver mediates supported downloads while validating destinations and bytes.
M8 adds OCI using the same manifest and archive format, not a different plugin runtime [S26].

### Catalogue v1

A signed static catalogue is sufficient for the first public alpha. It includes plugin ID, publisher
identity, source repository, title, description, categories, release records, compatibility, declared
capabilities, real screenshot references, moderation state and signatures. Search locally for a small
catalogue; add SQLite FTS behind an optional service as scale demands. No external search engine or
multi-tenant publisher account system is required to prove the product.

Filter by compatibility, UI profile, local/offline behavior, capabilities, interface provided, language
and accessibility review. Rank using transparent relevance, not invented downloads or paid placements.
The UI may say “No ratings yet.” It must not seed fake testimonials or download counts.

### Moderation and review

Publish a plugin-submission checklist: source/license, reproducible build instructions, permissions,
privacy explanation, no remote code, no hidden analytics, supported UI profile, mobile screenshots,
accessibility, package limits and acceptance tests. Review is not a mathematical guarantee. Name exactly
what a badge means. Curated catalogue inclusion can be stricter than direct repository installation.

Report an app, withdraw a release, revoke a digest, change publisher identity, rotate trust keys and
appeal a decision all need documented operator workflows. The reference alpha can manage these through
reviewed catalogue pull requests rather than an admin web application. Keep an audit log and preserve
previous signed metadata for investigation. Do not store user reports publicly when they contain private data.

### Update and dependency discovery

Poll catalogue updates opportunistically while the app is active; do not keep a browser worker alive.
A newly compatible release can be staged, but activation follows the lifecycle policy. Search by WIT
interface only when the catalogue has verified metadata for that interface. Auto-binding an arbitrary
provider because it exports the right type is unsafe; users or host policy select the provider.

### Trust receipt and revocation distribution

Publish trust roots with the shell, rotate with overlapping keys and a reviewed update, and maintain
receipt expiry and revoked-digest metadata. Validate signer identity and issuer narrowly [S15]. The
browser verifies the selected receipt and package digest. If the receipt authority is unavailable,
explain whether the action is blocked or allowed from a previous trusted cache; never show fresh
verification that did not occur.

### Commercial boundary

No paid marketplace or revenue sharing in v1. The framework's licence is separate from each plugin's
licence and from provider terms. Do not bundle model entitlement, sell another user's allowance, or
advertise a third-party plugin as an independently authorized ChatGPT partner merely because it calls
PWACloud. Hosted plugin-mediated plan use remains part of the explicit OpenAI review gate.

---

<a id="document-14"></a>

# Source: `docs/10-DATA.md`

## 10. Persistence and data ownership

### Browser stores

Use IndexedDB stores for workspaces, installations, manifests, verified receipts, grants, revisioned
settings, install journals, UI checkpoints, task summaries and plugin key/value records. Namespace all
plugin-owned records by workspace and stable plugin installation. Never infer ownership from a caller-
provided key prefix. The storage adapter prepends the namespace from the bound principal.

Put immutable package blobs and larger content in OPFS where available. Provide IndexedDB Blob fallback.
Keep package hashes and journal pointers in IndexedDB. The app can request persistent storage and inspect
quota estimates, but cannot guarantee the browser grants persistence or never evicts data [S11]. A plugin
quota is a logical ceiling under the origin's real quota, not reserved capacity.

Quotas include keys, metadata and values under a defined accounting rule. Updates replacing an existing
value charge the delta within a transaction. Parallel writes cannot exceed quota by racing read-check-write.
Reject a large write before copying it repeatedly. Keep documents separate from disposable package caches
so low-space cleanup removes safe cached bytes before valuable user content.

### Personal runtime stores

`contracts/runtime.sql` specifies a starting SQLite model for account metadata, workspaces, installations,
grants, sessions, AI runs, sequenced run events and usage reservations. OAuth tokens are **not** database
columns. The metadata may reference a permitted local credential-store record. Browser copies of provider
profiles contain only the minimum display and capability information. Identifiers used for account
binding are not sent to plugins unless needed and specifically authorized.

Use one writer with WAL where supported, explicit transactions, foreign keys, indexed ownership checks
and versioned migrations. Do not run a public multi-user hosted service by turning on a flag in this
single-user reference runtime. Separate tenancy requires a separately reviewed authorization model.

### State synchronization

The reference app is local-first, not automatically multi-device synced. A phone paired to a runtime can
observe that runtime's tasks; this is not a promise that every local document has been synchronized.
If document sync is added, expose conflict behavior and data location explicitly. Never silently upload
all local plugin content merely because ChatGPT is connected.

Each document or key has a revision. Writes use expected-revision checks where concurrent edits are
possible. Return conflicts with a recovery path. UI checkpoints are best-effort presentation state;
committed document saves need a stronger durable acknowledgement. A visible “Saved” label must follow
actual persistence, not just a debounce timer.

### Backups and exports

Provide per-plugin export, workspace export and restore preview. Validate import schemas, paths, sizes,
version compatibility and signatures where relevant. An exported data bundle is not an executable plugin
unless the user explicitly installs a separately verified package. Encrypting exports is optional but
must use maintained cryptographic libraries and a recoverability explanation. Never put tokens in exports.

Write a pre-migration backup before a nontrivial schema change. Record version, digest, timestamp and data
schema. Restoration must be rehearsed in tests. A backup written to the same browser storage may also be
lost to origin eviction; offer user-controlled file export rather than claiming it is disaster recovery.

### Retention and privacy defaults

Keep run metadata and errors with configurable retention; do not retain full prompts as analytics.
Store conversation history only for the feature and retention the user selected. Diagnostics use request
IDs, method names, durations, byte counts and coarse error codes. Content logging is off by default.
Deleting a plugin's data is distinct from disabling its executable. Account switch must close stale
ports, clear private in-memory state, and prevent old tasks from appearing in the new account UI.

### Consistency tests

Force termination at every install journal step; run parallel quota writes; interrupt migration before
and after pointer swap; simulate missing OPFS bytes, a full origin, a deleted IndexedDB database and
stale multitab leases. Ensure recovery never activates an unverified package or loses the last known
valid data without presenting recovery choices. Test data deletion/export against actual storage,
not just disappearing UI rows.

---

<a id="document-15"></a>

# Source: `docs/11-PERFORMANCE.md`

## 11. Performance, battery and accessibility budgets

All numbers below are proposed engineering targets. No result in this handoff claims they were measured
on the target PWA. Record the selected device, OS, browser, network profile, build and commit for each run.

| Area | Initial target | Measurement |
|---|---|---|
| Shell critical JavaScript | <= 450 KiB compressed | Production bundle report, no editor preloading |
| Initial shell transfer | <= 1 MiB excluding optional screenshots | Cold-cache network trace |
| Main content visible | <= 2.5 s on chosen mid-tier phone/network profile | Repeated recorded navigation |
| Cached plugin activation | <= 1 s p95 after shell readiness | 20 activations, explicit marks |
| Primary interaction delay | <= 200 ms p95 | Browser trace plus physical-device observation |
| Reference rich UI JS | <= 1.5 MiB compressed per plugin | Bundle report, exception review for heavy editors |
| Default package install | <= 20 MiB expanded | Manifest plus archive verification |
| Default Wasm linear memory | <= 64 MiB per guest | Inspect all guest module maxima |
| Phone runtime concurrency | 1 rich UI, 2 guest Workers | Runtime counters and lifecycle tests |
| Idle periodic polling | None unless required and consented | Idle trace and outbound request observation |
| Primary touch targets | 48 by 48 CSS pixels | Layout checks and actual touch QA |

These are budgets with explicit exception handling, not universal browser limits. Avoid per-plugin
iframes for tiny icons or list rows. Use host-rendered inert previews. Lazy-load full UI, Wasm, editors,
fonts, language packs and chart libraries only when needed. Bundle system fonts rather than fetching
third-party font services. Virtualize long collections without breaking screen-reader navigation.

### Scheduling and persistence

Batch stream display updates to avoid rerendering the entire app per token. Bound stream buffers and
pause reading or truncate delivered output with a visible state when the local display budget is exceeded.
Persist critical run events rather than every cosmetic animation. Save document edits with a measured
and visible durability policy. Excessive IndexedDB writes and needless Worker wakeups waste mobile power.

Use foreground/resume events and request-driven activation instead of continuously reconciling every
plugin. Detach listeners, disconnect observers, close MessagePorts, revoke object URLs and release
Workers on teardown. Test repeated open/close cycles for retained heap growth and duplicate handlers.
Do not use a fake progress timer that keeps a suspended app awake.

### Optional platform capabilities

GPU, advanced file pickers, Web Share, notifications, media capture and local models are detected at
runtime and subject to security context/user gesture/permissions. Provide an ordinary file-input or
copy/export fallback where appropriate. A plugin declaring a feature does not make it available.
No baseline requirement for SharedArrayBuffer or cross-origin isolation; this simplifies OAuth and
embedded compatibility. If a future feature needs isolation headers, design a separate tested profile.

### Accessibility acceptance

Automated checks run on the host and reachable plugin frames, followed by keyboard and screen-reader
review. Test 200% text enlargement, constrained width, reduced motion, dark mode, high contrast where
available, understandable focus transitions and errors announced to assistive technology. A summary
of automated violations is not proof of full WCAG conformance. Record manual findings and fixes.

### Device support policy

Start from an explicitly selected physical iPhone class and a mid-range Android class; record exact
hardware and OS/build in the release matrix. Include installed-PWA and ordinary-browser sessions.
Use Playwright Chromium and WebKit for deterministic regression tests, but do not call emulation a
physical iOS test [S27]. Test the current stable platforms and the oldest versions actually supported
by the selected feature baseline. Unsupported configurations receive a clear compatibility message.

### Profiling evidence

Keep redacted network traces, bundle sizes, screenshots and performance summaries. Use synthetic notes
and fake catalogue/user data. For a serious regression, retain a trace that connects a user action to
the responsible code path. A Lighthouse score alone is not the mobile acceptance gate. The release
report must state any accepted performance exception and the user-visible mitigation.

---

<a id="document-16"></a>

# Source: `docs/12-TESTING.md`

## 12. Verification strategy and evidence rules

### Three distinct proof levels

**Reference proof:** the supplied pure TypeScript primitives and schema/database fixtures pass their
tests. This only validates the supplied logic. It does not launch a PWA, compile a guest, verify an
actual publisher or authorize ChatGPT.

**Application proof:** a production build launches with real storage, frames, Workers, guest artifacts,
package verification and runtime transport. Provider protocol fixtures are useful here, but remain
fixtures. Integration tests must observe a real boundary, not just mock its wrapper.

**Release proof:** the actual end-to-end system passes the listed browser, hostile-plugin, physical-device,
publisher and real-provider cases. Hosted launch has additional external gates. A blocked test is not
passed; a mock result cannot replace an external prerequisite.

### Test pyramid

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

### Hostile fixture suite

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

### OpenAI test split

Fixture tests validate OAuth transactions, correct scope handling, request encoding, error shapes,
refresh races, model catalogue and streaming boundaries. Set up these fixtures without any real secret.
The real-provider suite runs only after explicit authorized login, uses short synthetic prompts and
checks actual completed inference plus cancellation. It must not run automatically on every public PR.
Do not fake ID tokens or provider JSON and call that “Sign in with ChatGPT works.”

Hosted prerequisites are verified documents/configuration under the owner's control, not an agent
checking a boolean in a JSON file. Record a redacted reviewer attestation without publishing contracts
or credentials. Where terms and docs conflict, retain the block until resolved.

### Evidence format

For each acceptance case record: case ID; implementation commit; UTC test time; status; actual environment;
commands/steps; exit code where relevant; artifact paths with SHA-256; brief observed outcome; and reviewer
for manual tests. Provider tests record mock vs real. Device tests record emulated vs physical. Failure
must retain its artifact and remediation. Never fill the example `pending` manifest with made-up passes.

`planning/acceptance-cases.json` is the authoritative case inventory. `planning/progress.json` starts
pending. `contracts/evidence.schema.json` defines the report. The reference gate illustrates refusing
missing, mocked or wrong-environment evidence; it cannot prove a report is truthful. CI must capture
artifacts and bind evidence to its actual commit/job. Require human review of manual/external evidence.

### CI lanes

PR lane: contract validation, typecheck, lint, unit, dependency boundaries, production build, browser
integration, hostile smoke suite, accessibility checks and secret scanning using synthetic data.
Release lane: clean checkout, frozen dependency install, complete browser/hostile suites, package
reproducibility check, SBOM/licence review, signed artifacts and redacted evidence. Physical devices and
real-provider checks are separately authorized gates, not secrets-enabled PR jobs.

Do not disable tests with `continue-on-error`, blanket retries or skipped assertions. A small explicit
flaky-test policy can quarantine a test only with an issue, owner and expiry, and cannot waive a security,
real-provider or mobile critical path. `verify:release` must fail if mandatory evidence is missing.

### What counts as complete

A functional local alpha requires all local-alpha cases, including real authorized ChatGPT use and
actual iPhone/Android QA, to pass. Without those external tests it is a development build, even if all
code is implemented. Hosted release additionally needs hosted-specific cases. Non-AI local features
remain releasable with clear labels, but cannot be marketed as completed ChatGPT integration.

---

<a id="document-17"></a>

# Source: `docs/13-IMPLEMENTATION.md`

## 13. Dependency-ordered implementation plan

Execute work, not just documentation. `planning/milestones.json` supplies machine-readable dependencies
and target modules. No calendar estimate is implied. Each milestone requires its own commit and evidence.

### M0: feasibility and repository foundation

Inspect/reuse or create the authorized public repository without overwriting history. Bootstrap the pnpm
workspace and strict TypeScript tooling. Resolve compatible maintained versions and freeze lockfiles.
Run three spikes before building the main app: opaque-frame single-bundle assets plus CSP in Chromium/
WebKit; a real Rust Component Model guest transformed by pinned Jco and run in a Worker; and a clearly
mocked personal-runtime streaming protocol with correct request/identity separation. Record browser
navigation residuals and provider prerequisites. Exit only with runnable spike commands and test artifacts.

### M1: phone-first shell and offline baseline

Implement Home, Library, Discover, Activity and Settings routes using Ionic/React. Add safe areas,
keyboard-aware layouts, host back-stack, theme/text preferences and accessibility primitives. Create the
web manifest, icons and custom service worker with prompt-to-update behavior [S10]. No automatic reload
while edits/tasks exist. Persist a simple local note through real IndexedDB. Test 360-pixel layout and
production-build offline relaunch. Exit with no dead-end navigation or fake sign-in success.

### M2: contracts, scopes and transport

Move the tested reference policy rules into production modules with strict schema validation. Implement
principal-bound frame/Worker handshakes, request correlation, limits, cancellation and revocation. Add
permission sheets and scoped file/document handles. Build the isolated UI loader using verified local
assets. Prove React and Lit content can render and call storage while host DOM and unauthenticated API
access are denied. Exit with hostile-message regression tests and two independently bundled UIs.

### M3: signed packages and repository installation

Implement CLI manifest validation/pack/inspect, deterministic archives, release envelope, digest checks,
Sigstore verification in the personal verifier and browser verification receipts. Build fixture releases
and the real reference release. Implement Resolve -> Review -> Download -> Ready with cancellation and
recoverable errors. Add strict archive and SSRF validation. Exit with a phone-sized app installing a real
signed public reference package by repository URL, without rebuilding the shell.

### M4: guest runtime and lifecycle controller

Implement trusted Jco transformation/loader, WIT effect/event bridge, bounded guest calls, scheduler,
checkpoints, termination and crash backoff. Integrate install journals and multitab fencing. Keep guest
services on demand. Prove a real Wasm output affects the UI, a hanging guest is terminated, and app
resume recreates state without replaying external writes. Exit with verified Worker and lifecycle traces.

### M5: expressive sample plugins and local capabilities

Finish Notebook with rich editing and Wasm text analysis; Feed Reader with Lit, virtualized lists and
brokered HTTP; Canvas Board with responsive SVG/canvas editing and accessible non-drag controls.
Implement quotas, selected-document sharing, network proxy policy, permission revocation and plugin
settings. Sample data is synthetic. Exit with all three usable at 360 pixels, genuine frame/service
boundaries and a denial case observed at the network target.

### M6: personal runtime and actual ChatGPT integration

Implement supported local registration, protected local credentials, session lifecycle, phone pairing,
provider catalogue, direct-plan request adapter, local budgets, durable runs, cancellation and reconnect.
No hosted token vault. Run fixture protocol tests and then an explicitly authorized real sign-in/inference
smoke test. If human login is unavailable, mark that test blocked and continue all independent work.
Exit requires real entitlement evidence, not a mocked spinner or API-key substitution.

### M7: scoped tools and agent composition

Add a small host agent loop using supported tool calls, typed schemas, explicit document handles,
per-tool grants and user confirmation for writes. Demonstrate Notebook -> Canvas Board through an approved
service binding. Add prompt-injection fixtures and maximum-step/run limits. Do not implement arbitrary
shell or install permissions. Exit with an authorized successful composition and a denied escalation.

### M8: update, rollback and marketplace hardening

Add a curated signed catalogue, interface-aware filters, precise verification badges, update diffs,
new-grant consent, staged migrations, safe rollback, uninstall/export and revocation feed. Implement OCI
as another transport over the same artifact contract. Resolve whole dependency graphs explicitly.
Exit with interrupted-update recovery, stale/offline metadata handling and a rejected malicious release.

### M9: framework extraction and device polish

Prove a second minimal non-Ionic embedding host using the packages rather than copying shell internals.
Finish SDK docs and authoring templates. Run accessibility, performance, repeated open/close, real keyboard,
back gesture and background/resume tests. Fix physical-device problems rather than adding screenshots
of emulator passes. Exit with actual iPhone/Android evidence and documented supported browser matrix.

### M10: local alpha release

Run clean-clone frozen install, all code gates, hostile suite, real public Git install, real-provider and
physical-device acceptance. Publish signed code/package releases, accurate README, redacted evidence,
SBOM/license notices and recovery instructions. Verify a clean user installation without development
secrets. No full-completion claim while mandatory cases are blocked. The local-alpha label does not
imply hosted approval.

### M11: approved hosted mobile launch, externally gated

Only after the owner obtains the applicable client/integration authorization, credential-custody decision,
and confirmation of installed-plugin scope, enable the hosted adapter with its exact documented flow.
Test direct mobile sign-in, account isolation, revocation, data retention and abuse protections under
that authorization. This is intentionally a separate release gate. Do not invent permission to finish it.

### Parallel work

After M0, UI and contracts work can proceed in parallel with module ownership. Package/runtime work
needs M2 transport contracts. Provider implementation can use fixtures while waiting for M3/M4 integration.
Security tests should be developed alongside the boundary they test. Use subagents only when available,
with explicit file/module ownership and an integration reviewer. They cannot certify their own unrun tests.

---

<a id="document-18"></a>

# Source: `docs/14-OPERATIONS.md`

## 14. Repository bootstrap, environments and release operations

### Repository publication

The intended target is `StevenBuglione/pwacloud`, public. The authoring session could not create or push
it; `PUBLICATION_STATUS.md` records the observed limitation. The included publication script is executable
from a development environment with Git and authenticated GitHub CLI. It checks the login, refuses a
resolved existing target, stages only the handoff inventory, and never force-pushes or changes visibility.

```sh
# Review files, then run from this directory in the authenticated Codex environment.
node --experimental-strip-types scripts/publish-github.ts --publish
```

GitHub CLI's repository-create operation supports explicit owner and public visibility [S29]. The script
performs no authentication for the user and never requests a token in chat. If credentials or creation
permissions are missing, keep local development moving and report the exact missing permission.

If the target already exists, clone it through the authorized connection and inspect its history,
visibility and license. Do not run the creation script. Add the handoff on a new branch, preserve source
already present, and push/review through the normal workflow. If it is private, do not change visibility
without a separate explicit decision about its existing contents. A read 404 can mean inaccessible, so
never assume an arbitrary repo is empty based on that alone.

### Environment matrix

Development: loopback hosts, synthetic fixtures, mock AI explicitly labeled, no production signing keys.
Test: production-build shell, fixture release service, isolated temporary databases and test trust roots.
Personal: user's local runtime, legitimate protected credentials, own session origin, authorized pairing.
Hosted: disabled until the documented provider and custody gates are resolved. Public shell/catalogue
hosting can be independent of an inference backend and must not imply hosted AI is available.

Use `.env.example` only as documentation. No provider token is a `VITE_*` variable. Validate configuration
on startup, including origin allowlists, root keys and enabled mode. Reject contradictory combinations,
such as hosted plan use with no approved integration configuration. Production startup must not silently
select the mock provider. Display unmistakable mode indicators in development and diagnostic screens.

### Personal deployment

Provide a signed/reproducible local runtime package and a documented startup command by M6. Bind loopback
by default. Phone access requires explicit HTTPS configuration, authentication and pairing under user
control. Validate Host/Origin to resist DNS rebinding. Terminate TLS with the configured local service
or a user-controlled reverse proxy, preserving secure session semantics. Never expose a raw model relay
or unauthenticated port on the LAN. Do not require Kubernetes to run the first release.

Local OAuth must be completed on the computer hosting the loopback callback. Protect credential files
with restrictive permissions or OS vault APIs and atomic refresh replacement. Avoid logging authorization
URLs. Keep runtime identity stable across restarts. Revocation and deletion are documented user actions.
VM credential persistence remains disabled until the terms/documentation issue is resolved.

### Continuous integration

The supplied `handoff.yml` runs only reference tests and audits, not product acceptance. Replace/extend it
with pinned production workflows during M0-M3. Required application workflows: PR checks, hostile/browser
checks, example-package release, catalogue validation, and protected release verification. Pin third-party
Actions by immutable commit after verifying upstream identity. Never claim pinned security based on a
moving tag in a starter workflow.

Do not run privileged builds on `pull_request_target` while checking out untrusted contributor code.
Keep write/signing permissions at job scope. Allow only known release branches/tags. Keep CI artefacts
free of browser auth state, credentials and real prompts. Public cloud runners are not a place to store
long-lived end-user SIWC tokens.

### Operational signals

Expose local health for the runtime and structured status to the PWA. Track package verification failure,
worker crash, grant denial, migration failure, resumed/interrupted run and provider admission error.
Do not log contents by default. An unavailable model is distinct from runtime unhealthy. Provide a
safe-mode launch with plugins disabled, diagnostics export, backup export and a trust metadata refresh.

### Release checklist

Run from a clean clone. Record exact commit and toolchain. Install with frozen lockfiles, build, run all
required tests and validate real-device/provider evidence. Scan staged content for secrets and review
license/SBOM. Sign immutable artifacts and publish checksums. Confirm the public repo/release URLs by
reading them after publication. Update status badges only after real jobs exist. Publish documented
known limits and recovery instructions with the release.

A GitHub repository is not a deployed PWA. State separately whether source, signed plugins, catalogue,
web hosting, personal-runtime distribution, and hosted ChatGPT integration have each been delivered.

### Bootstrap CI status
The included `handoff.yml` executes reference checks only. It has not run on GitHub in the authoring
session. It uses floating major action references and a reproduction Node version from the authoring
container, with no provider/deployment/signing secrets. They are not a production security baseline.
M0 must verify maintained compatible dependencies, pin Actions to reviewed immutable commit SHAs,
select patched supported runtime versions, and preserve frozen lockfiles before expanding CI privileges.
No guessed or fabricated commit hashes were inserted into the bootstrap workflow.

---

<a id="document-19"></a>

# Source: `docs/15-RISKS.md`

## 15. External gates and unresolved risks

| ID | Issue | Required action | Default behavior |
|---|---|---|---|
| R01 | Hosted SIWC eligibility/client configuration | Owner obtains applicable authorization and exact flow | Hosted plan mode disabled |
| R02 | Remote persistent-token text conflicts across terms/docs | Obtain clarification or applicable partner terms | Protected local store only; VM persistence disabled |
| R03 | Third-party plugins under one connected-app scope | Confirm installed-plugin use, attribution and boundaries | No general-purpose API relay; hosted marketplace AI launch gated |
| R04 | Rich iframe UI residual navigation/DoS | Document/test, restrict exposed data, review publishers | Never promise perfect no-egress or process isolation |
| R05 | Mobile memory, suspension and storage eviction | Physical-device tests, checkpoints, quotas, export | On-demand execution and clear recovery |
| R06 | Jco/browser/toolchain compatibility | M0 real guest and UI asset spikes | Do not silently substitute JS for Wasm |
| R07 | Registry signatures prove identity, not safety | Review, provenance, reproducibility tests, revocation | Precise badges; no “verified safe” label |
| R08 | Public GitHub write access absent in authoring environment | Use authenticated Codex/CLI publication | Local repo-ready handoff, no fake URL |
| R09 | Real OAuth or phone hardware unavailable to Codex | Owner performs controlled required test | Keep evidence blocked, finish independent code |
| R10 | Name/npm namespace availability | Review before branding/publishing packages | Working name only |
| R11 | Browser-origin proxy could become SSRF or generic AI relay | Strict principal/auth/origin/endpoint policy and independent review | No unauthenticated remote proxy |
| R12 | Plugin migration cannot safely roll back data | Snapshot/version compatibility proof | Recovery-required instead of destructive rollback |

The core user experience remains the goal: install a PWA, connect ChatGPT, install tools, grant permission,
and use expressive apps from a phone. The local paired-runtime route proves the integration without
pretending pure-mobile local OAuth or approved hosted custody already exists. These gates should be
visible to the owner, not hidden behind optimistic implementation status.

No architectural evidence in this handoff establishes legal compliance, provider approval, complete
sandbox security, App Store eligibility, guaranteed budget ceilings or perpetual storage durability.
Release claims must match the actual deployment and tested scope.

---

<a id="document-20"></a>

# Source: `docs/16-DEMO.md`

## 16. Required end-to-end demonstrations

### Demo A: useful without login

On a clean phone-sized production build, start without an account. Open Notebook, create and format
a synthetic note, invoke a real Wasm word/heading analysis, close and reopen the plugin, go offline,
edit again and relaunch the PWA. Show that saved content persists. The Wasm output must carry fixture
input/output provenance in the test trace so a JS stub cannot accidentally satisfy the assertion.

### Demo B: repository install and rich UI

Paste the reference plugin repository URL. Resolve the signed release. Show actual publisher/version,
package size and capabilities. Deny optional network access. Install and open the independently bundled
React plugin. Install the Lit Feed Reader and demonstrate permitted HTTP after consent, plus an explicit
ungranted URL that is never fetched by the target. Cancel a second installation and prove no grants or
enabled artifact remain. Bad-digest and wrong-signer releases must fail before execution.

### Demo C: ChatGPT plan from the phone

Complete authorized supported local sign-in on the personal runtime computer. Pair a physical phone
using HTTPS without copying provider credentials into the PWA. Show actual provider state/model list,
approve Notebook's AI capability and summarize a selected synthetic note. Display a real streamed result
with a terminal completion event. Inspect browser/plugin state to confirm token absence. Revoke the
plugin's AI grant and show its next call denied before provider dispatch. No API-key fallback.

Record clearly that this is a phone client paired to a personal runtime, not an approved standalone
hosted mobile sign-in. Demo hosted sign-in separately only when the external gates are met.

### Demo D: suspension and task recovery

Start a task, choose either cancellation-on-disconnect or explicitly authorized personal-runtime
continuation, then switch apps/lock the phone. Return and reconnect using the same run ID and last
sequence. Prove no second model request occurred because of reconnection. Keep partial results honestly
marked if the original stream was interrupted. Local UI/guest state must recover after Worker teardown.

### Demo E: composition, update and escape resistance

Grant Canvas Board one-time read access to a selected Notebook document. Convert a summary into a canvas
layout using typed approved tools. Attempt to read another note and deny it. Stage an update that adds a
network permission, decline it, and retain the old version. Interrupt a data migration and restore safely.
Open hostile frame/guest fixtures and show denied host privilege escalation, Worker hang recovery and
the documented iframe navigation residual. Uninstall with retained-data and delete-data paths separately.

### Demo F: accessibility and polish

Record physical iPhone/Android installation, keyboard use, small-width layout, back navigation, task Stop,
permission review and export. Test VoiceOver/TalkBack with labels and focus. No clipped confirmation,
unreachable toolbar, invisible caret, or horizontal whole-page overflow. Capture dark/light and large-text
screens from the real product build, not generated mockups. Update catalogue screenshots from those assets.

---

<a id="document-21"></a>

# Source: `docs/adr/0001-ui-isolation.md`

## ADR 0001: isolated UI session rather than shared-realm microfrontend loading

Status: accepted. Rich plugins use a bundled app in an opaque-origin iframe with a principal-bound
MessagePort. Shared-realm remote modules and custom elements do not enforce marketplace trust boundaries.
First-party components remain ordinary host code. Restricted data-handling plugins can use audited
host-rendered UI. Consequence: theme, navigation, file access and overlays need explicit SDK bridges;
arbitrary UI egress and process DoS cannot be perfectly eliminated by an iframe.

---

<a id="document-22"></a>

# Source: `docs/adr/0002-async-effects.md`

## ADR 0002: effect/event ABI for asynchronous guest operations

Status: accepted. Guests execute bounded synchronous handlers and emit typed effects. The host performs
async storage/network/AI work and returns correlated events. This avoids blocking the UI thread or
relying on experimental async component support. Consequence: guest SDKs need a small state machine;
WIT interfaces remain versioned, and RPC/service routing still needs host implementation.

---

<a id="document-23"></a>

# Source: `docs/adr/0003-personal-ai-runtime.md`

## ADR 0003: personal-runtime plan usage before gated hosted launch

Status: accepted with external gates. Supported local OAuth and protected local credentials are the
reference integration. The phone pairs to that runtime over authenticated HTTPS. Hosted and VM custody
are not inferred from public-source status. Consequence: first setup may require a computer. Direct
hosted mobile sign-in remains the product goal but needs actual approved configuration and custody rules.

---

<a id="document-24"></a>

# Source: `docs/adr/0004-distribution.md`

## ADR 0004: one immutable plugin format, multiple transports

Status: accepted. Use GitHub Release archives/envelopes first and OCI as an adapter over the same signed
content model. Browser installation verifies both a trusted receipt and artifact bytes. Consequence:
receipt issuance is a visible trust dependency. It does not imply an arbitrary signed package is safe
or independently reproducible. Git remains the publisher entry point, not an arbitrary runtime compiler.

---

<a id="document-25"></a>

# Source: `docs/adr/0005-mobile-lifecycle.md`

## ADR 0005: on-demand mobile reconciliation

Status: accepted. Installation is durable; execution is ephemeral. One rich UI and a small bounded Worker
pool run only when needed. The service worker manages offline/cache updates, not persistent plugins.
Consequences: checkpointing, run journals, idempotent effects and explicit personal-runtime background
consent are required. Browser suspension is normal and cannot be fixed with an infinite heartbeat.

---

<a id="document-26"></a>

# Source: `planning/IMPLEMENTATION_STATUS.md`

## Starting status for Codex

This archive delivers the complete engineering handoff and executable reference primitives. It does not
contain a working PWA application, completed OAuth implementation, built Wasm guest, live marketplace,
finished sample plugin, or deployed service. Those are the explicitly assigned implementation deliverables.

The 57 product acceptance cases all start pending. Passing reference tests does not mark a milestone done.
Authoring checks are reported separately in `evidence/AUTHORING-VALIDATION.md`.

### Work that can proceed without external authorization
Implement the shell, offline persistence, packaging, signing fixtures, worker runtime, full plugin UI,
controller, scoped networking, protocol fixtures, provider adapter, lifecycle, catalog, SDK and CI.
Use synthetic data and clearly labeled mock AI while implementing. Do not stop all development because
real login, real phones or hosted approval is unavailable.

### External evidence needed for the requested final product
A GitHub-authenticated environment with write permission must publish the repo. A user must complete
real supported ChatGPT authorization and approve the integration smoke test. Physical iPhone and Android
QA must be performed. Smooth consumer hosted sign-in needs applicable authorization plus a resolved
credential-custody model and installed-plugin scope. Mark each unavailable gate blocked, never passed.

The minimal local development command, production run command, deployment environment and any approval
requirements must be documented with actual commands by M10. A mock success screen is not the deliverable.

---

<a id="document-27"></a>

# Source: `PUBLICATION_STATUS.md`

## Publication status

Requested target: `StevenBuglione/pwacloud`, public.

The GitHub connector authenticated as `StevenBuglione`. A metadata read for the intended repository
returned HTTP 404. That establishes only that the connector could not resolve it, not proof that the
name is universally available. The connected actions exposed repository reads but no repository-create
or file-write action. Plugin discovery found the existing GitHub integration but no additional usable
write action. This authoring runtime had neither the GitHub CLI nor a configured `GH_TOKEN`/
`GITHUB_TOKEN`. No managed connector credential was extracted.

**No GitHub repository, branch, commit, issue, release, or deployment was created remotely.**

The complete repository-ready handoff is provided locally. Run the supplied publication script from
Codex's authenticated development environment. It checks the account and target again before creating
anything. An existing repo is not overwritten or made public automatically. Missing permissions are
an external blocker, not an excuse to stop local development.

---

<a id="document-28"></a>

# Source: `evidence/AUTHORING-VALIDATION.md`

## Authoring validation results

Validated: **2026-10-01T20:53:47Z**. These checks cover this handoff, **not a completed PWA**.

### Executed checks

| Check | Result | Evidence |
|---|---|---|
| Node reference unit tests | 135/135 passed; 0 failed; 0 skipped | `evidence/authoring/reference-tests.tap` |
| Strict TypeScript reference compilation check | Exit 0 | `evidence/authoring/typecheck.log` (empty because no diagnostics) |
| Structural, cross-reference and SQLite constraint audit | 347 checks passed | `evidence/authoring/structural-audit.json` |
| JSON Schema and semantic fixtures | 49 checks passed across 5 schemas and 3 plugin manifests | `evidence/authoring/contract-validation.json` |
| Pending release-evidence gate | Correctly rejected incomplete evidence, exit 1 | `evidence/authoring/release-gate.log` |
| Publication helper | Dry run exit 0 and syntax check exit 0 | `evidence/authoring/publication-dry-run.log` |

The reference tests include real WebCrypto SHA-256 and ECDSA P-256 operations with generated test keys,
URL/grant checks, lifecycle action selection, model-catalog/request shaping, chunked UTF-8/SSE parsing,
request admission, and evidence-gate rejection. Test identities, models, report rows and signing keys
are fixtures, not real provider accounts or publisher proofs. SQLite constraints execute in memory.

The structural audit's own redirected-output scan was corrected during authoring and the final audit
was rerun successfully. This does not change any product milestone from pending to passed.

### Actual environment

Node v22.16.0; Version 5.8.3; Python 3.13.5.
The schema validator was jsonschema 4.26.0. Environment: Linux-6.18.44-x86_64-with-glibc2.41.
These versions describe the authoring harness, not the production version recommendation.

### Not executed or not available

No complete PWA, real iframe/Worker browser integration, Rust/WIT/Jco guest compilation, actual ZIP
loader, real GitHub release install, Cosign publisher verification, physical iPhone/Android test,
real OAuth sign-in, real ChatGPT inference, hosted integration, deployed service, or GitHub Actions
run was executed. The product's 57 acceptance cases remain pending in the implementation ledger.
The WIT and OpenAPI files are implementation contracts, not claims of working guest/runtime services.

GitHub account identity was read as StevenBuglione. The repository probe returned 404; this is not
proof of global name availability. The connected tools exposed reads, and this container had no
authenticated gh CLI or configured GitHub write token. No remote repository, branch, issue, commit,
release or deployment was created. Use the publication helper from an authorized environment.

The release gate is deliberately blocked. It must not be bypassed to make a screenshot or demo look done.

---

<a id="document-29"></a>

# Source: `docs/REFERENCES.md`

## Primary-source reference register

Checked 2026-10-01. Bracketed S-identifiers in the documents refer here. Design choices and numeric budgets are proposed requirements, not claims that the linked tools implement PWACloud. No provider approval has been obtained.

### S01: Sign in with ChatGPT quickstart

<https://developers.openai.com/siwc/quickstart>

Integration availability and separation of identity from plan use.

### S02: OSS plan-usage overview

<https://developers.openai.com/siwc/token-sharing-open-source>

Client registration, host identity and hosted-program boundary.

### S03: Models and inference

<https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference>

Account-specific models and documented inference transport.

### S04: Sign in with ChatGPT Terms

<https://openai.com/policies/sign-in-with-chatgpt-terms/>

September 29, 2026 terms; custody and connected-app restrictions require attention.

### S05: Self-hosted VMs

<https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms>

Personal VM credential-transfer guidance; compare with terms before deployment.

### S06: Accounts and sessions

<https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions>

Account isolation, refresh, sign-out and credential handling.

### S07: Registration and sign-in

<https://developers.openai.com/siwc/token-sharing-open-source/sign-in>

Supported OSS authorization and returned registration identity.

### S08: SIWC UI/UX guidance

<https://developers.openai.com/siwc/ui-ux-guidelines>

User-facing plan-use onboarding and approved sign-in presentation.

### S09: Ionic React PWA

<https://ionicframework.com/docs/react/pwa>

Reference shell framework and PWA integration.

### S10: Vite PWA injectManifest

<https://vite-pwa-org.netlify.app/guide/inject-manifest.html>

Custom service-worker build integration.

### S11: WebKit storage policy

<https://webkit.org/blog/14403/updates-to-storage-policy/>

Browser quotas and persistence constraints; do not promise reserved plugin space.

### S12: Component Model Jco

<https://component-model.bytecodealliance.org/running-components/jco.html>

Component tooling and JavaScript transformation.

### S13: Jco transpiling

<https://bytecodealliance.github.io/jco/transpiling.html>

Browser transformation and import mapping.

### S14: HTML iframe reference

<https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe>

Sandbox attributes and origin boundaries.

### S15: Sigstore verification

<https://docs.sigstore.dev/cosign/verifying/verify/>

Signer identity/issuer verification, not a claim of code safety.

### S16: Content Security Policy Level 3

<https://www.w3.org/TR/CSP3/>

Resource policy primitives; not a universal egress firewall.

### S17: WCAG 2.2 target size

<https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>

Accessibility baseline; the project chooses larger primary targets.

### S18: ServiceWorkerGlobalScope

<https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope>

Idle termination and state reconstruction.

### S19: CSP embedded enforcement

<https://www.w3.org/TR/csp-embedded-enforcement/>

Do not depend on experimental embedding policy as the only sandbox.

### S20: CORS

<https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS>

Host fetch remains subject to browser cross-origin rules.

### S21: Website SIWC

<https://developers.openai.com/siwc/website>

Registered website identity integration and backend transaction flow.

### S22: SIWC preview limitations

<https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations>

Supported request shape, unsupported options/tools and continuation limits.

### S23: Codex app-server with SIWC

<https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server>

Optional personal-runtime integration, not a browser service.

### S24: Using a ChatGPT plan in apps/sites

<https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites>

End-user eligibility and usage controls.

### S25: SIWC errors and recovery

<https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery>

Permission checks, admission errors and explicit recovery.

### S26: Wasm packaging in OCI

<https://wasmcloud.com/docs/overview/packaging/>

OCI artifact distribution as an adapter.

### S27: Playwright emulation

<https://playwright.dev/docs/emulation>

Emulated device parameters; retain separate real-device acceptance.

### S28: WIT reference

<https://component-model.bytecodealliance.org/design/wit.html>

Interface type syntax and versioned contracts.

### S29: GitHub CLI repo create

<https://cli.github.com/manual/gh_repo_create>

Authorized repository creation from a local checkout.

### S30: Playwright browsers

<https://playwright.dev/docs/browsers>

Browser engine testing and version pinning.

### Reverification

Before enabling real provider or hosted deployment, recheck S01-S08 and S21-S25. Preserve a dated change note and rerun the adapter contract suite. Before adopting a browser feature or upgrading a toolchain, rerun the specific capability spike and phone tests. Do not copy source documentation into this repository wholesale.

---

# Product acceptance inventory

All cases below start **pending**. Reference unit-test passes do not substitute for these cases.

## FND-01: Clean workspace, compatible frozen toolchains and public-repository safety

Milestone M0. Required for: local-alpha, hosted.

A clean checkout builds all feasibility spikes; existing repository history and visibility are never overwritten.

## FND-02: Opaque-frame feasibility in Chromium and WebKit

Milestone M0. Required for: local-alpha, hosted.

Bundled React UI renders with real CSP; host DOM access fails; self-navigation residual is explicitly demonstrated.

## FND-03: Real Component Model guest in a Worker

Milestone M0. Required for: local-alpha, hosted.

Pinned Rust/WIT/Jco build produces a real artifact, executes in a dedicated Worker, and returns a checked value.

## FND-04: Mock protocol labeled as mock

Milestone M0. Required for: local-alpha, hosted.

Stream reconnect works against a synthetic server; every UI and evidence record says mock, not ChatGPT connected.

## UI-01: 360-pixel mobile navigation and route restoration

Milestone M1. Required for: local-alpha, hosted.

Home, Library, Discover, Activity and Settings work with Back, safe areas and independent tab histories.

## UI-02: Offline production-build relaunch and durable edit

Milestone M1. Required for: local-alpha, hosted.

A note survives reload/offline relaunch from actual IndexedDB; unsaved and unavailable states are accurate.

## UI-03: Accessible basic navigation and update prompt

Milestone M1. Required for: local-alpha, hosted.

Keyboard order, names and contrast checks pass; shell update does not discard an active edit.

## RPC-01: Principal-bound port and request authentication

Milestone M2. Required for: local-alpha, hosted.

Forged plugin ID, copied nonce, wrong window, old generation and replayed channel cannot act as another installation.

## RPC-02: Payload limits, cancellation and teardown

Milestone M2. Required for: local-alpha, hosted.

Oversized and duplicate messages, too many in-flight calls and messages after revoke fail closed.

## RPC-03: Two independent UI frameworks

Milestone M2. Required for: local-alpha, hosted.

Separately built React and Lit packages render, persist data through grants, and unmount without leaving handlers.

## RPC-04: Host DOM and browser API isolation

Milestone M2. Required for: local-alpha, hosted.

Iframe host DOM access and unauthenticated broker requests are denied at actual boundaries, not mocked wrappers.

## RPC-05: Direct egress and self-navigation risk

Milestone M2. Required for: local-alpha, hosted.

Fetch, image and WebSocket routes are observed against controlled targets; residual navigation is documented with honest limits.

## PKG-01: Deterministic pack and strict manifest

Milestone M3. Required for: local-alpha, hosted.

Repeat pack has identical bytes; unknown fields, traversal, symlinks, duplicates and compressed/expanded size bombs fail.

## PKG-02: Signature, identity, provenance and receipt verification

Milestone M3. Required for: local-alpha, hosted.

Actual test signatures pass only for approved issuer/identity and digest; tamper, wrong identity and expired receipt fail.

## PKG-03: Actual public GitHub release installation

Milestone M3. Required for: local-alpha, hosted.

Paste a real public repository URL and install its signed compatible artifact without rebuilding the host.

## PKG-04: Interrupted install is recoverable

Milestone M3. Required for: local-alpha, hosted.

Cancel, offline transition and termination at each journal stage leave either old/absent install or a valid new one.

## PKG-05: Resolver and network SSRF boundary

Milestone M3. Required for: local-alpha, hosted.

Private, loopback, IPv6, mapped, redirect and DNS-rebinding targets are blocked including actual socket peer enforcement.

## RUN-01: Guest effect/event async bridge

Milestone M4. Required for: local-alpha, hosted.

Real guest requests HTTP/storage via effects and receives correlated completion; no Promise is passed to a synchronous WIT import.

## RUN-02: Timeout, memory growth and crash backoff

Milestone M4. Required for: local-alpha, hosted.

Endless guest terminates while host remains recoverable; linear-memory growth fails as expected; crash loop backs off.

## RUN-03: Lazy mobile scheduling and demand

Milestone M4. Required for: local-alpha, hosted.

Inactive plugins do not poll or execute; default limits of one rich UI and two guest workers are observed.

## RUN-04: Checkpoint and multitab fencing

Milestone M4. Required for: local-alpha, hosted.

Leader replacement increments fence; stale actor cannot commit; resume restores checkpoint without repeating external writes.

## RUN-05: Quarantine and unknown imports

Milestone M4. Required for: local-alpha, hosted.

Unknown WIT imports and publisher JavaScript worker glue never execute; quarantine revokes ports and stops instances.

## APP-01: Notebook is a real mobile plugin

Milestone M5. Required for: local-alpha, hosted.

Actual isolated editor saves offline, displays actual Wasm analysis and has undo/error states; no hard-coded success.

## APP-02: Feed Reader is a real Lit plugin

Milestone M5. Required for: local-alpha, hosted.

Controlled real HTTP feed, virtualization, refresh, offline snapshot and network revocation all work.

## APP-03: Canvas Board expressive and accessible UI

Milestone M5. Required for: local-alpha, hosted.

SVG/canvas editing, non-drag alternative, zoom and keyboard actions work at 360 pixels and persisted state reloads.

## APP-04: Quota, handles and storage isolation

Milestone M5. Required for: local-alpha, hosted.

Concurrent writes respect quota; plugin B cannot read plugin A or unselected documents; revoke invalidates prior handles.

## APP-05: Revocation blocks the next request

Milestone M5. Required for: local-alpha, hosted.

Observe controlled server logs: after grant revocation no new brokered request is emitted; cancellation has documented races.

## AI-01: OAuth protocol and account binding

Milestone M6. Required for: local-alpha, hosted.

State, nonce, PKCE, issued client ID, workspace and direct-plan scope enforced; stale or wrong-account callbacks rejected.

## AI-02: Protected local credential custody

Milestone M6. Required for: local-alpha, hosted.

Tokens absent from page, frames, logs, exports, IndexedDB, caches and SQL metadata; local protected store and refresh race tested.

## AI-03: Provider catalog and supported request encoding

Milestone M6. Required for: local-alpha, hosted.

Catalog parses models with visibility/slug/display_name; request is stream=true/store=false without unsupported parameters/tools.

## AI-04: Actual authorized ChatGPT-plan completion

Milestone M6. Required for: local-alpha, hosted.

User completes official sign-in on their local runtime; a synthetic short prompt gets a real terminal completed response.

Additional gate: real authorized provider.

## AI-05: Actual provider cancellation and disconnect

Milestone M6. Required for: local-alpha, hosted.

Real user-authorized request cancellation and subsequent reconnect show truthful interrupted/cancelled state without duplicate execution.

Additional gate: real authorized provider.

## AI-06: Budget, idempotency and admission race

Milestone M6. Required for: local-alpha, hosted.

Concurrent calls respect per-plugin limits; duplicate client submission does not create another provider request; counts survive restart.

## AI-07: Durable stream replay on phone

Milestone M6. Required for: local-alpha, hosted.

Drop stream connection, resume from last event ID and receive journaled events without another model call or duplicated text.

## AI-08: Identity-only, no entitlement and provider errors

Milestone M6. Required for: local-alpha, hosted.

Scope denial, unavailable model, limits, refresh failure and sign-out produce actionable states and never paid fallback.

## AI-09: Local runtime pairing from a real phone

Milestone M6. Required for: local-alpha, hosted.

Pair actual phone to the personal runtime over authenticated HTTPS; browser gets only app session; revoked pairing no longer works.

Additional gate: physical device.

## AI-10: Shared and remote token modes fail closed

Milestone M6. Required for: local-alpha, hosted.

Hosted/VM persistent-token paths cannot be enabled by an ordinary user flag without verified release authorization.

## AGT-01: Explicit inter-plugin service binding

Milestone M7. Required for: local-alpha, hosted.

Notebook exports only selected document through approved binding; Canvas Board consumes it with bounded inputs.

## AGT-02: Prompt-injection and tool authority

Milestone M7. Required for: local-alpha, hosted.

Malicious content cannot expand grants, choose a stronger principal, expose secrets, install code, or bypass write approval.

## AGT-03: Step limits, cancellation and human write approval

Milestone M7. Required for: local-alpha, hosted.

Agent stops at configured limit; denied write never executes; replay does not duplicate confirmed actions.

## UPD-01: Permission-expanding update requires new consent

Milestone M8. Required for: local-alpha, hosted.

Old grant does not authorize new release permissions; denied expansion keeps the usable old version.

## UPD-02: Staged migration, interruption and safe rollback

Milestone M8. Required for: local-alpha, hosted.

Power/termination injection at each migration step preserves consistent data; incompatible downgrade is refused or restored from snapshot.

## UPD-03: Signed catalog, revocation and stale metadata

Milestone M8. Required for: local-alpha, hosted.

Wrong identity, revoked package and expired install metadata rejected; installed offline mode displays revocation freshness honestly.

## UPD-04: OCI transport equivalent to release transport

Milestone M8. Required for: local-alpha, hosted.

Same envelope/digest from OCI installs under identical checks; authentication/CORS never bypass policy.

## UPD-05: Dependencies and uninstall/export

Milestone M8. Required for: local-alpha, hosted.

Cycles/conflicts rejected before install; shared dependency preserved; export/delete are explicit, consistent and recoverable.

## FWK-01: Second independent embedding host

Milestone M9. Required for: local-alpha, hosted.

A minimal non-Ionic host consumes released workspace packages and loads the same plugins without copied shell internals.

## DEV-01: Physical iPhone installation and keyboard

Milestone M9. Required for: local-alpha, hosted.

Home Screen install/relaunch, safe areas, software keyboard, Back and app switching tested with named iPhone/iOS version.

Additional gate: physical device.

## DEV-02: Physical Android installation and keyboard

Milestone M9. Required for: local-alpha, hosted.

Installed Chrome PWA, keyboard, system Back, offline/resume and permissions tested with named phone/OS/browser.

Additional gate: physical device.

## DEV-03: VoiceOver and TalkBack critical flows

Milestone M9. Required for: local-alpha, hosted.

On real devices, screen readers complete install, plugin operation, consent, cancel and recovery without unlabeled traps.

Additional gate: physical device.

## DEV-04: Phone performance and repeated open/close

Milestone M9. Required for: local-alpha, hosted.

Record target budgets, 20-run latency distribution and repeated plugin mount cycles on named hardware; no unbounded accumulation.

Additional gate: physical device.

## DEV-05: OS eviction and long background recovery

Milestone M9. Required for: local-alpha, hosted.

Actual app switch/sleep/relaunch plus controlled storage-pressure tests preserve/export data or clearly report recovery limits.

Additional gate: physical device.

## REL-01: Clean clone production build and tests

Milestone M10. Required for: local-alpha, hosted.

Frozen install, lint, typecheck, production build and complete tests pass from a clean commit without local secrets.

## REL-02: Release evidence completeness

Milestone M10. Required for: local-alpha, hosted.

Every local-alpha mandatory case has matching-commit artifacts, correct environment and honest pass status; blocked/mocked evidence rejected.

## REL-03: Signed public alpha and recovery drill

Milestone M10. Required for: local-alpha, hosted.

Public release, signed artifacts, SBOM/licenses and redacted evidence accessible; clean user installs and restores a backup.

## HST-01: Hosted authorization and credential-scope clarification

Milestone M11. Required for: hosted.

Owner records applicable authorization including storage rules and third-party plugin scope; reviewers verify it, not merely a flag.

Additional gate: reviewed external authorization.

## HST-02: Real mobile hosted sign-in and inference

Milestone M11. Required for: hosted.

Approved hosted flow works on phone with actual eligible plan and terminal response; no desktop-loopback assumptions.

Additional gate: real authorized provider.

## HST-03: Hosted tenant isolation, revoke and retention

Milestone M11. Required for: hosted.

Verified hosted terms reflected in implementation; cross-tenant requests blocked, grants revoked, retention and deletion tested.

