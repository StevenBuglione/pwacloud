# 03. Mobile interaction specification

This is an implementation contract, not a suggestion to build desktop UI first.

## Navigation model

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

## Shared component contract

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

## S01: welcome and device readiness

Present the value proposition and “Start without an account.” Do not force login to create local notes.
Show “Connect ChatGPT” only with an honest mode description. Demo builds say “Try demo AI” and label
mock output. Local mode offers “Connect to my runtime” with a concise explanation that a personal
computer must host AI requests. Hosted mode stays unavailable until approved; do not draw a working
sign-in button that only returns fake success.

Check secure context, storage availability and minimum required browser features. A missing optional
feature disables only its related action. Offer install guidance after the user has accomplished a
useful action. On iOS use contextual Add to Home Screen instructions; on browsers with install events,
use the browser-supported prompt. Never display a fabricated native install dialog.

## S02: Home

Header: product name, small actual connection indicator, Settings. Content: recent tool, recent saved
items, pinned tools, and one active-task card if work is running. Empty state links to Notebook and
Discover. Offline state is a non-blocking banner. An unavailable AI runtime does not cover the screen
or disable local navigation. Do not show invented statistics, ratings or usage percentages.

## S03: Library

Search installed apps by name and commands. List rows show icon, title, one-line purpose, state and
an accessible menu. Opening a row opens the tool, not its settings. Manage opens a detail sheet or
page with version, permissions, storage, publisher, update status, disable and uninstall.
Show “Paused to save memory” for an intentionally unloaded app, not a failure badge.

## S04: Discover

Search field at top, curated categories and compact app rows. A category tap filters instead of
opening stacked navigation levels. Display only real catalogue data. Separate “works on this device,”
“needs connection,” and “not compatible” states. Include “Install from repository” as a visible action
with a paste-friendly field and an example format. Clipboard reading happens only on explicit input
and browser permission; never read it automatically on launch.

## S05: app details

Include publisher/repository, pinned release, last published date, package size, UI isolation profile,
required versus optional capabilities, screenshots from the real version, license, source/provenance
badges with precise definitions, compatible host API, and a clear Install button. Screenshots require
alt text. Permission explanations must be specific: “Read documents you select,” not “Access files.”
No “verified safe” badge. A cryptographic signature is not a safety review.

## S06: repository resolution and install

Keep the flow to four intelligible steps: Resolve, Review, Download, Ready. The review sheet identifies
the canonical repository and release digest. Show changed permissions for an update. Do not use a
spinner indefinitely. Surface rate limit, no compatible release, bad signature, incompatible API,
insufficient storage and offline as distinct recoverable states. Cancelling mid-download removes
staging state and grants; an existing installed version remains untouched.

## S07: permission sheet

The host owns this UI outside plugin frames. Separate required grants from optional grants. Denied
optional grants do not prevent installation. Explain the consequences of denying a required grant.
AI access includes context scope, responsible provider/account label, plugin request cap, cancellation,
and whether explicitly authorized background operation is available. The profile warning for arbitrary
web UI must not imply perfect network confinement. Do not overwhelm users with WIT names or raw JSON.

A sensitive action confirmation states the exact object and operation, such as “Allow Canvas Board to
read this note once?” Approval binds the resource, plugin, run, generation and expiry. “Approve all
future actions” is not the default. Return focus to the invoking control after closing.

## S08: plugin content viewport

A plugin owns a real responsive app, not a small dashboard card. Notebook has a full-height editor,
a formatting row, document picker, and AI panel as a full-page or bottom-sheet route. Feed Reader has
virtualized feed rows and readable article detail. Canvas Board uses one-finger tool selection and
explicit pan/zoom modes; provide a non-drag alternative for moving objects.

At 360 pixels, a desktop split view becomes routes or segment controls. Never shrink three desktop
panes into unreadable columns. Frames use a single intentional scroll container. Avoid scroll traps,
double overscroll, lost text selection and repeated remounting during streaming. Floating controls
must not cover the last editor lines. Plugin overlays must remain inside their viewport or request
host-owned overlays through a safe API.

## S09: AI composer and task controls

Show the provider label and selected model display name from the actual catalogue. Display the data
scope before sending. Use explicit Send, Stop and Retry. During a stream, preserve scroll when the
user reads earlier text and offer a jump-to-latest button. Partial output survives a disconnect as
partial output, never relabeled a completed answer. Errors distinguish access unavailable, consent
missing, rate limit, interrupted transport, incompatible feature and unavailable personal runtime.

Use a first-use plan-usage notice consistent with provider guidance, not on every login [S08]. Do not
promise extra ChatGPT allowance. Local request counts are labeled as PWACloud's counts; unknown
provider limits remain unknown. Account switching cancels or isolates active runs and clears visible
private state before rendering another account's data.

## S10: Activity

A chronological list of tasks with plugin, action, start time, state and Stop when relevant. Tap for
redacted events, selected inputs, outputs and retry controls. Distinguish browser-local work from work
continuing on the personal runtime. Show queued consent as “Needs approval.” On reconnect, join the
existing run ID and event cursor. Never submit another billable request just to rebuild the UI.

## S11: settings and usage

Sections: Appearance, Runtime & ChatGPT, App permissions, Storage & export, Updates, Privacy, Diagnostics.
Provide a prominent disconnect/revoke flow. Local session sign-out and provider revocation are different
operations; reflect actual results. Export prompts warn about included private content. Diagnostic
exports redact prompts and tokens by default and require explicit user action.

## S12: update and recovery

An update sheet lists version, publisher, capability changes and data-migration implications. Do not
reload during an edit or active task. Save, pause, apply, restore. A failed plugin update restores the
previous artifact only when its data remains compatible; otherwise restore the pre-migration snapshot
or present recovery choices. Uninstall separately asks whether to retain data and export it first.

## Accessibility and device proof

Test keyboard navigation, VoiceOver on an actual iPhone, TalkBack on an actual Android, zoomed text,
reduced motion and dark mode. Verify accessible names inside frames as well as host chrome. Avoid
asserting automated accessibility checks prove conformance. `planning/acceptance-cases.json` includes
required manual/device cases and the exact evidence fields.
