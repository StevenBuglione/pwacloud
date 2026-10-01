# 00. Product definition

## Thesis

PWACloud is a reusable, open, mobile-first application framework plus a reference application.
It lets a person install independent tools into one PWA, give each tool narrowly scoped capabilities,
and use them through genuinely rich interfaces. The same installation can be used on a phone,
tablet, and computer, but the phone is the design center. The framework can also be embedded in
another PWA without forcing that application to copy this reference shell.

The differentiator is not “WebAssembly runs in a browser.” It is the complete route from a publisher's
Git repository to an understandable, permissioned, reversible installation, combined with a shared
AI integration that does not distribute credentials to plugins.

## Who uses it

The primary end user wants useful tools on a phone without repeatedly configuring accounts or API
keys. They understand an app library, permission sheet, and task history; they should not need to
understand pods, OCI, WIT, workers, containers, or deployment reconciliation. The plugin author wants
the rendering freedom of web development and a documented SDK. The embedding developer wants to
add this extension system to an existing product. The operator wants auditable releases and no
surprise infrastructure or AI bills.

## Core journeys

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

## What version 1 includes

A mobile shell; install/update/disable/uninstall; signed release resolution; an expressive isolated UI
profile; an optional restrictive host-rendered profile; real Wasm workers; scoped storage and network;
a local/user-controlled AI integration; a curated catalogue; versioned contracts; three real sample
plugins; hostile fixtures; transparent diagnostics; accessible onboarding; and tested recovery.

The reference app is free to use with ChatGPT-plan integration where authorized. No paywall, subscription
resale, quota pooling, or background consumption by default. Later commercial services require separate
product and provider review. This is a product decision, not a claim that all OpenAI programs share
identical commercial rules. See the specific source constraints in `06-OPENAI.md`.

## What version 1 does not include

No native App Store submission, arbitrary source-code builds on install, full Kubernetes, distributed
browser clusters, unrestricted shell inside a PWA, private Git repository credential management,
automatic installation of transitive UI apps, paid marketplace, real-time collaboration, full local
LLM provisioning, or promises that every browser supports every GPU/media API.

A plugin “backend” initially means its Wasm service in a browser Worker, not an arbitrary remote
server. Long-running optional services belong to a separately authorized personal runtime. There is
no invisible cloud execution behind the word “plugin.”

## Success measures

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

## Language and branding

Use “Apps” or “Tools” in user-facing navigation and “Plugins” in developer/diagnostic screens.
Use “Needs attention” rather than “CrashLoopBackOff.” Keep the Kubernetes analogy in technical docs.
Use the working name PWACloud until a collision/trademark review is completed. Do not imply OpenAI
ownership, certification, endorsement, or that the user's ChatGPT subscription is unlimited.
