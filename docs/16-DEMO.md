# 16. Required end-to-end demonstrations

## Demo A: useful without login

On a clean phone-sized production build, start without an account. Open Notebook, create and format
a synthetic note, invoke a real Wasm word/heading analysis, close and reopen the plugin, go offline,
edit again and relaunch the PWA. Show that saved content persists. The Wasm output must carry fixture
input/output provenance in the test trace so a JS stub cannot accidentally satisfy the assertion.

## Demo B: repository install and rich UI

Paste the reference plugin repository URL. Resolve the signed release. Show actual publisher/version,
package size and capabilities. Deny optional network access. Install and open the independently bundled
React plugin. Install the Lit Feed Reader and demonstrate permitted HTTP after consent, plus an explicit
ungranted URL that is never fetched by the target. Cancel a second installation and prove no grants or
enabled artifact remain. Bad-digest and wrong-signer releases must fail before execution.

## Demo C: ChatGPT plan from the phone

Complete authorized supported local sign-in on the personal runtime computer. Pair a physical phone
using HTTPS without copying provider credentials into the PWA. Show actual provider state/model list,
approve Notebook's AI capability and summarize a selected synthetic note. Display a real streamed result
with a terminal completion event. Inspect browser/plugin state to confirm token absence. Revoke the
plugin's AI grant and show its next call denied before provider dispatch. No API-key fallback.

Record clearly that this is a phone client paired to a personal runtime, not an approved standalone
hosted mobile sign-in. Demo hosted sign-in separately only when the external gates are met.

## Demo D: suspension and task recovery

Start a task, choose either cancellation-on-disconnect or explicitly authorized personal-runtime
continuation, then switch apps/lock the phone. Return and reconnect using the same run ID and last
sequence. Prove no second model request occurred because of reconnection. Keep partial results honestly
marked if the original stream was interrupted. Local UI/guest state must recover after Worker teardown.

## Demo E: composition, update and escape resistance

Grant Canvas Board one-time read access to a selected Notebook document. Convert a summary into a canvas
layout using typed approved tools. Attempt to read another note and deny it. Stage an update that adds a
network permission, decline it, and retain the old version. Interrupt a data migration and restore safely.
Open hostile frame/guest fixtures and show denied host privilege escalation, Worker hang recovery and
the documented iframe navigation residual. Uninstall with retained-data and delete-data paths separately.

## Demo F: accessibility and polish

Record physical iPhone/Android installation, keyboard use, small-width layout, back navigation, task Stop,
permission review and export. Test VoiceOver/TalkBack with labels and focus. No clipped confirmation,
unreachable toolbar, invisible caret, or horizontal whole-page overflow. Capture dark/light and large-text
screens from the real product build, not generated mockups. Update catalogue screenshots from those assets.
