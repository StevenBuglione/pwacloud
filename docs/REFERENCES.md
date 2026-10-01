# Primary-source reference register

Checked 2026-10-01. Bracketed S-identifiers in the documents refer here. Design choices and numeric budgets are proposed requirements, not claims that the linked tools implement PWACloud. No provider approval has been obtained.

## S01: Sign in with ChatGPT quickstart

<https://developers.openai.com/siwc/quickstart>

Integration availability and separation of identity from plan use.

## S02: OSS plan-usage overview

<https://developers.openai.com/siwc/token-sharing-open-source>

Client registration, host identity and hosted-program boundary.

## S03: Models and inference

<https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference>

Account-specific models and documented inference transport.

## S04: Sign in with ChatGPT Terms

<https://openai.com/policies/sign-in-with-chatgpt-terms/>

September 29, 2026 terms; custody and connected-app restrictions require attention.

## S05: Self-hosted VMs

<https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms>

Personal VM credential-transfer guidance; compare with terms before deployment.

## S06: Accounts and sessions

<https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions>

Account isolation, refresh, sign-out and credential handling.

## S07: Registration and sign-in

<https://developers.openai.com/siwc/token-sharing-open-source/sign-in>

Supported OSS authorization and returned registration identity.

## S08: SIWC UI/UX guidance

<https://developers.openai.com/siwc/ui-ux-guidelines>

User-facing plan-use onboarding and approved sign-in presentation.

## S09: Ionic React PWA

<https://ionicframework.com/docs/react/pwa>

Reference shell framework and PWA integration.

## S10: Vite PWA injectManifest

<https://vite-pwa-org.netlify.app/guide/inject-manifest.html>

Custom service-worker build integration.

## S11: WebKit storage policy

<https://webkit.org/blog/14403/updates-to-storage-policy/>

Browser quotas and persistence constraints; do not promise reserved plugin space.

## S12: Component Model Jco

<https://component-model.bytecodealliance.org/running-components/jco.html>

Component tooling and JavaScript transformation.

## S13: Jco transpiling

<https://bytecodealliance.github.io/jco/transpiling.html>

Browser transformation and import mapping.

## S14: HTML iframe reference

<https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe>

Sandbox attributes and origin boundaries.

## S15: Sigstore verification

<https://docs.sigstore.dev/cosign/verifying/verify/>

Signer identity/issuer verification, not a claim of code safety.

## S16: Content Security Policy Level 3

<https://www.w3.org/TR/CSP3/>

Resource policy primitives; not a universal egress firewall.

## S17: WCAG 2.2 target size

<https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>

Accessibility baseline; the project chooses larger primary targets.

## S18: ServiceWorkerGlobalScope

<https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope>

Idle termination and state reconstruction.

## S19: CSP embedded enforcement

<https://www.w3.org/TR/csp-embedded-enforcement/>

Do not depend on experimental embedding policy as the only sandbox.

## S20: CORS

<https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS>

Host fetch remains subject to browser cross-origin rules.

## S21: Website SIWC

<https://developers.openai.com/siwc/website>

Registered website identity integration and backend transaction flow.

## S22: SIWC preview limitations

<https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations>

Supported request shape, unsupported options/tools and continuation limits.

## S23: Codex app-server with SIWC

<https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server>

Optional personal-runtime integration, not a browser service.

## S24: Using a ChatGPT plan in apps/sites

<https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites>

End-user eligibility and usage controls.

## S25: SIWC errors and recovery

<https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery>

Permission checks, admission errors and explicit recovery.

## S26: Wasm packaging in OCI

<https://wasmcloud.com/docs/overview/packaging/>

OCI artifact distribution as an adapter.

## S27: Playwright emulation

<https://playwright.dev/docs/emulation>

Emulated device parameters; retain separate real-device acceptance.

## S28: WIT reference

<https://component-model.bytecodealliance.org/design/wit.html>

Interface type syntax and versioned contracts.

## S29: GitHub CLI repo create

<https://cli.github.com/manual/gh_repo_create>

Authorized repository creation from a local checkout.

## S30: Playwright browsers

<https://playwright.dev/docs/browsers>

Browser engine testing and version pinning.

## Reverification

Before enabling real provider or hosted deployment, recheck S01-S08 and S21-S25. Preserve a dated change note and rerun the adapter contract suite. Before adopting a browser feature or upgrading a toolchain, rerun the specific capability spike and phone tests. Do not copy source documentation into this repository wholesale.
