// Build script (run-once): splits public/mockups/sequencer-sandbox.html into
// the three modules consumed by <SequencerEditor>:
//   - src/components/sequencer/markup.ts  (inner HTML of .screen as a string)
//   - src/components/sequencer/styles.ts  (CSS, patched to skip phone chrome
//                                          and apply via .sequencer-app)
//   - src/components/sequencer/setup.ts   (JS, wrapped in a mountSequencer
//                                          function with init-state + onChange
//                                          + readOnly hooks)
//
// Re-run after changes to the mockup. Idempotent.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'public/mockups/sequencer-sandbox.html'), 'utf8');

// --- 1. extract sections ----------------------------------------------------
function between(start, end) {
  const s = src.indexOf(start);
  const e = src.indexOf(end, s + start.length);
  if (s < 0 || e < 0) throw new Error('section missing: ' + start);
  return src.slice(s + start.length, e);
}
const rawCss = between('<style>', '</style>');
const rawBody = between('<body>', '</body>');
const rawJs = between('<script>\n', '</script>'); // the second <script>, after the Tone.js CDN tag
// Strip the leading "// ---------- Pitches" comment marker is preserved, no trim.

// --- 2. transform CSS -------------------------------------------------------
// Goal: keep the mockup's classed styles, drop the phone-frame / page-reset
// rules (they'd shrink the editor and mess with the surrounding app shell).
function transformCss(css) {
  let out = css;
  // Drop the html, body and body { ... } resets (they centre the device on
  // a 100vh backdrop). The sequencer fills its own container.
  out = out.replace(/^\s*html,\s*body\s*\{[^}]*\}\s*$/m, '');
  out = out.replace(/^\s*body\s*\{[\s\S]*?\}\s*$/m, '');
  // Drop the * { box-sizing... } global — re-add scoped under .sequencer-app.
  out = out.replace(/^\s*\*\s*\{[^}]*\}\s*$/m, '');
  // Drop .device and .device::before (phone bezel + dynamic island) — keep
  // .screen which becomes our wrapper.
  out = out.replace(/^\s*\.device\s*\{[\s\S]*?^\s*\}\s*$/m, '');
  out = out.replace(/^\s*\.device::before\s*\{[\s\S]*?^\s*\}\s*$/m, '');
  // Drop .caption (sandbox-only instructions panel) and its descendant rules.
  out = out.replace(/^\s*\.caption[^{]*\{[\s\S]*?^\s*\}\s*$/gm, '');
  // Drop the fake iOS status bar — we render no .status element. The
  // descendant rules (.status .right, .status svg) target nodes that don't
  // exist either, so they're harmless dead CSS — leaving them avoids a
  // tricky regex that ate adjacent rules.
  out = out.replace(/^\s*\.status\s*\{[\s\S]*?^\s*\}\s*$/m, '');
  // Re-target ".screen" rules at our wrapper class. The original .screen rule
  // had a 4-row grid (status, topbar, stage, bottom); drop the first row
  // since we no longer render the status bar.
  out = out.replace(
    /grid-template-rows:\s*44px\s+56px\s+1fr\s+auto/g,
    'grid-template-rows: 56px 1fr auto',
  );
  // .screen had border-radius 36px (phone corners) + overflow hidden — let
  // them through, but override sizing so we fill the React container.
  out = out.replace(/\.screen\b/g, '.sequencer-app');
  // The mockup re-declares design tokens on :root (--accent, --bar, etc.).
  // Scope them to .sequencer-app so they don't bleed into the app shell.
  out = out.replace(/^\s*:root\s*\{/m, '.sequencer-app {');
  // Scope-prefix to avoid global selector leakage. We rely on the fact that
  // .sequencer-app is the editor root — anything inside is fair game.
  return [
    '.sequencer-app, .sequencer-app * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }',
    // Block iOS Safari from treating long-presses on grid step labels /
    // notes / pills as a text selection. The native selection gesture
    // also hijacks pointer events, which broke multi-touch and surfaced
    // a "Cancel selection / Copy / Look Up" popover that wouldn't close.
    '.sequencer-app, .sequencer-app * { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }',
    // touch-action: manipulation disables double-tap-to-zoom and pinch
    // gesture recognition globally inside the editor. Without it, iOS
    // pauses event delivery on a second touch while it decides whether
    // the user is starting a zoom — that's what was breaking multi-touch
    // (knob drag + piano tap simultaneously). The piano keeps pan-y
    // locally so the keyboard can still scroll vertically.
    '.sequencer-app { touch-action: manipulation; }',
    // Inputs we *do* want selectable: the song-title input lives inside
    // the keyboard popup.
    '.sequencer-app input[type="text"], .sequencer-app input:not([type]) { user-select: text; -webkit-user-select: text; }',
    '.sequencer-app { position: relative; width: 100%; height: 100%; border-radius: 0 !important; }',
    // Cursor-menu / param-popover overlays. The popover sits inside the
    // overlay; a click on the overlay itself (not bubbled from the
    // popover) closes it. Click is the most reliable iOS dismiss path —
    // pointerdown can be dropped during gesture recognition.
    '.seq-menu-overlay { position: fixed; inset: 0; z-index: 1000; background: transparent; }',
    '.seq-menu-overlay > .cursor-menu, .seq-menu-overlay > .param-popover { position: absolute; }',
    out,
  ].join('\n');
}

const css = transformCss(rawCss);

// --- 3. transform body HTML -------------------------------------------------
// We keep only the .screen contents. The outer .device/.caption/<aside> are
// mockup chrome.
function extractScreenInner(body) {
  const screenOpen = body.indexOf('<div class="screen">');
  if (screenOpen < 0) throw new Error('.screen missing');
  // find matching </div> for .screen by depth-counting
  const start = body.indexOf('>', screenOpen) + 1;
  let depth = 1;
  let i = start;
  while (depth > 0 && i < body.length) {
    const nextOpen = body.indexOf('<div', i);
    const nextClose = body.indexOf('</div>', i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) return body.slice(start, nextClose);
      i = nextClose + 6;
    }
  }
  throw new Error('.screen unclosed');
}
let bodyHtml = extractScreenInner(rawBody);
// Drop the simulated iOS status bar (real device shows its own).
bodyHtml = bodyHtml.replace(/<!-- status bar -->[\s\S]*?<\/div>\s*<\/div>\s*/, '');

// --- 4. transform JS --------------------------------------------------------
// The mockup script runs at the top level. We wrap it as `mountSequencer`
// which takes a root container and options (initialState / onChange /
// readOnly) and returns a teardown function.
function transformJs(js) {
  // Replace getElementById('foo') with root.querySelector('#foo') so the JS
  // is scoped to the React-managed container. The mockup uses both the $
  // helper (returns getElementById result) and direct getElementById calls.
  let out = js;
  out = out.replace(/document\.getElementById\(/g, 'root.querySelector("#"+');
  // The $ helper:
  //   const $ = (id) => document.getElementById(id);
  // Replace with root-scoped equivalent.
  out = out.replace(
    /const \$ = \(id\) => document\.getElementById\(id\);/,
    'const $ = (id) => root.querySelector("#"+id);',
  );
  // Already replaced by the getElementById line above; this rewrite is a no-op
  // safety net for variations.

  // Tone is imported as a namespace at the top of setup.ts; nothing to rewrite.

  // Hook `pushUndo` to fire onChange after every mutation. Cheapest place to
  // intercept: append `if (onChange) onChange(snapshotState());` to it.
  out = out.replace(
    /function pushUndo\(\) \{([\s\S]*?)\n  \}/,
    (m, body) =>
      `function pushUndo() {${body}\n    if (options.onChange) options.onChange(JSON.parse(snapshotState()));\n  }`,
  );

  // Seed state from options.initialState when present.
  out = out.replace(
    /const state = \{/,
    "const __seed = options.initialState; const state = __seed ? Object.assign({\n    cursor: 0, playhead: null, selectedId: null, multiSelect: false, selectedIds: new Set(), rangeSelectAnchor: null, chordMode: false, chordStep: null, clipboard: null, playing: false, defaultSize: 1, snap: 'step', keyboardZoom: 1.0, scaleOn: false, scaleRoot: 'C', scaleType: 'major',\n  }, __seed) : {",
  );
  // The closing of `const state = {` block above changed shape; if seeding,
  // we need to not double-create. To keep the change minimal we always emit
  // both versions and pick at runtime. Simpler: keep original block but
  // overlay __seed AFTER construction.

  // Revert the above clever-but-fragile splice. Use a safer approach:
  // append a post-state overlay just after the state object is built.
  return out;
}

// Drop the clever pre-seed splice — do a clean post-overlay instead. We rerun
// transformJs without the state edit and then append an overlay.
function transformJsClean(js) {
  let out = js;
  out = out.replace(/document\.getElementById\(/g, 'root.querySelector("#"+');
  out = out.replace(
    /const \$ = \(id\) => root\.querySelector\("#"\+id\);/,
    'const $ = (id) => root.querySelector("#"+id);',
  );
  // pushUndo runs *before* the mutation it makes undoable. Notifying
  // options.onChange synchronously here would hand the parent the
  // pre-mutation state, so the autosave would always be one action behind
  // and drop the last edit on tab close. queueMicrotask defers the
  // notification to after the current synchronous task (the caller's
  // mutation + renderGrid) has completed.
  out = out.replace(
    /function pushUndo\(\) \{([\s\S]*?)\n  \}/,
    (m, body) =>
      `function pushUndo() {${body}\n    if (options.onChange) queueMicrotask(() => options.onChange(JSON.parse(snapshotState())));\n  }`,
  );
  // Capture the rAF handle so destroy() can cancel it before init runs on a
  // torn-down DOM. Also gate the body of init() on the destroyed flag — once
  // destroyed=true (set by the React effect cleanup), init must no-op.
  out = out.replace(/\brequestAnimationFrame\(init\);\s*$/m, '__raf = requestAnimationFrame(init);');
  out = out.replace(
    /function init\(\) \{/,
    'function init() {\n    if (__destroyed) return;',
  );
  // Capture the window resize listener so destroy() can remove it. Without
  // this, navigating away leaves a permanent resize handler that fires
  // renderKeys/renderGrid on a cleared root and throws.
  out = out.replace(
    /window\.addEventListener\("resize", \(\) => \{([\s\S]*?)\}\);/,
    (m, body) =>
      `__resizeHandler = () => {${body}};\n    window.addEventListener("resize", __resizeHandler);`,
  );
  return out;
}
const jsBody = transformJsClean(rawJs);

// Build the setup.ts file.
const setupTs = `// AUTO-GENERATED from public/mockups/sequencer-sandbox.html.
// Re-run \`node scripts/build-sequencer.mjs\` after editing the mockup.
// eslint-disable
// @ts-nocheck
import * as Tone from 'tone';

export interface MountOptions {
  initialState?: unknown;
  onChange?: (state: unknown) => void;
  readOnly?: boolean;
  // Song-level integration hooks (no-ops in the standalone mockup):
  onBack?: () => void;
  onRenameTitle?: (title: string) => void;
  onCopy?: () => void;
  songTitle?: string;
  isOwner?: boolean;
  creatorDisplay?: string;
}

export function mountSequencer(root: HTMLElement, options: MountOptions = {}): () => void {
  let __destroyed = false;
  let __raf = 0;
  let __resizeHandler: (() => void) | null = null;
${jsBody}
  // applySnapshot overrides state from options.initialState (if provided)
  // *after* all functions are declared. This re-uses the mockup's own snapshot
  // restore path so renderers re-build channel synths / grid / pills correctly.
  try {
    if (options.initialState) applySnapshot(JSON.stringify(options.initialState));
  } catch (err) { console.warn('sequencer initialState load failed', err); }

  if (options.readOnly) root.classList.add('seq-readonly');

  return () => {
    __destroyed = true;
    if (__raf) { try { cancelAnimationFrame(__raf); } catch (_) {} __raf = 0; }
    if (__resizeHandler) { try { window.removeEventListener('resize', __resizeHandler); } catch (_) {} __resizeHandler = null; }
    try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch (_) {}
    try { Object.keys(channelSynths).forEach((id) => disposeChannelSynth(+id)); } catch (_) {}
    // Sweep popovers/menus/toasts the editor mounted on document.body — they
    // live outside \`root\` so root.innerHTML='' wouldn't catch them.
    try {
      document.querySelectorAll('[data-seq-popover]').forEach((el) => el.remove());
    } catch (_) {}
    root.innerHTML = '';
  };
}
`;

// --- 5. write outputs -------------------------------------------------------
const outDir = path.join(ROOT, 'src/components/sequencer');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'markup.ts'),
  '// AUTO-GENERATED — do not edit; see scripts/build-sequencer.mjs\n' +
    'export const sequencerHtml = ' +
    JSON.stringify(bodyHtml) +
    ';\n',
);
fs.writeFileSync(
  path.join(outDir, 'styles.ts'),
  '// AUTO-GENERATED — do not edit; see scripts/build-sequencer.mjs\n' +
    'export const sequencerCss = ' +
    JSON.stringify(css) +
    ';\n',
);
fs.writeFileSync(path.join(outDir, 'setup.ts'), setupTs);

console.log('wrote markup.ts, styles.ts, setup.ts');
