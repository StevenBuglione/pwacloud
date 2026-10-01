# M9 extraction, accessibility and timing evidence

The non-Ionic minimal host imports workspace package exports and declares workspace dependencies. It opens the same verified Notebook package through the same controller, runtime and SDK, stores data in an independent IndexedDB database and runs the real Wasm analyzer. Its browser case passed in both Chromium and WebKit in the last owned app run.

Automated axe checks exercise all four host tabs, dark mode, 200-percent text, reduced motion and all three actual plugin frames. The checks assert zero violations, assert that the frames were tested and check document width within the 360-pixel viewport. Full reports retain passes and incomplete checks rather than treating automated checks as screen-reader certification. `chromium-frame-accessibility.json`, `webkit-frame-accessibility.json`, enlarged Settings screenshots and each enlarged app screenshot are the evidence. Explicit font fallbacks prevent the Windows WebKit engine from silently using its serif fallback.

The repeated activation case opens and closes Notebook 20 times, independently checks the visible ready state, requires one rich frame when open and zero when closed, and retains every timing sample. Its engineering budget remains p95 at or below 1000 ms. Physical device performance remains unverified.

## Failures retained and measurement correction

The earlier end timestamp was recorded when Playwright's repeated assertion noticed `Local notes ready`. A retained trace showed approximately 140 ms of click tooling followed by roughly 875 ms of assertion polling. This included the assertion's 100/250/500 ms backoff rather than ending when the app actually became ready. The last owned 20-case run passed 19 cases and failed that WebKit timing assertion at 1041 ms. The assertion was not removed and its budget was not increased. Records: `owned-shell-full-results.json`, `webkit-tool-observed-readiness-budget-failure.json`, `browser-app-complete-shell.log`, and the ignored local failure trace.

The final instrumentation measures from the host activation mark to Notebook's animation-frame readiness mark after its saved data and DOM are ready. Host and frame timestamps use their own `performance.timeOrigin` plus mark time. The test still independently asserts visible readiness, nonnegative duration, the same 1000 ms budget and frame teardown. The root's final build and browser run must execute this instrumentation and the added update/provider-mode/New-note assertions before recording acceptance. Final `*-activation-performance.json` files contain the measurement definition and raw distributions.

A trusted host encoding optimization uses bounded cached base64 and chunked encoding while retaining fresh principals, nonces, ports and per-mount asset verification. The production build now emits actual compressed static representations rather than relying only on a Vite gzip estimate. Final server transfer checks belong to the root integration evidence.

No result here claims a real iPhone, Android, VoiceOver, TalkBack, OS eviction or live ChatGPT entitlement. Raw traces are retained locally and ignored because even a synthetic browser run can contain app-session cookies or CSRF values. Public evidence must remain redacted, and final case dispositions must be tied to the final integration commit.
