# 11. Performance, battery and accessibility budgets

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

## Scheduling and persistence

Batch stream display updates to avoid rerendering the entire app per token. Bound stream buffers and
pause reading or truncate delivered output with a visible state when the local display budget is exceeded.
Persist critical run events rather than every cosmetic animation. Save document edits with a measured
and visible durability policy. Excessive IndexedDB writes and needless Worker wakeups waste mobile power.

Use foreground/resume events and request-driven activation instead of continuously reconciling every
plugin. Detach listeners, disconnect observers, close MessagePorts, revoke object URLs and release
Workers on teardown. Test repeated open/close cycles for retained heap growth and duplicate handlers.
Do not use a fake progress timer that keeps a suspended app awake.

## Optional platform capabilities

GPU, advanced file pickers, Web Share, notifications, media capture and local models are detected at
runtime and subject to security context/user gesture/permissions. Provide an ordinary file-input or
copy/export fallback where appropriate. A plugin declaring a feature does not make it available.
No baseline requirement for SharedArrayBuffer or cross-origin isolation; this simplifies OAuth and
embedded compatibility. If a future feature needs isolation headers, design a separate tested profile.

## Accessibility acceptance

Automated checks run on the host and reachable plugin frames, followed by keyboard and screen-reader
review. Test 200% text enlargement, constrained width, reduced motion, dark mode, high contrast where
available, understandable focus transitions and errors announced to assistive technology. A summary
of automated violations is not proof of full WCAG conformance. Record manual findings and fixes.

## Device support policy

Start from an explicitly selected physical iPhone class and a mid-range Android class; record exact
hardware and OS/build in the release matrix. Include installed-PWA and ordinary-browser sessions.
Use Playwright Chromium and WebKit for deterministic regression tests, but do not call emulation a
physical iOS test [S27]. Test the current stable platforms and the oldest versions actually supported
by the selected feature baseline. Unsupported configurations receive a clear compatibility message.

## Profiling evidence

Keep redacted network traces, bundle sizes, screenshots and performance summaries. Use synthetic notes
and fake catalogue/user data. For a serious regression, retain a trace that connects a user action to
the responsible code path. A Lighthouse score alone is not the mobile acceptance gate. The release
report must state any accepted performance exception and the user-visible mitigation.
