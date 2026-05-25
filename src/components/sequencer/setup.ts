// AUTO-GENERATED from public/mockups/sequencer-sandbox.html.
// Re-run `node scripts/build-sequencer.mjs` after editing the mockup.
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
  // ---------- Pitches C0..C8 ----------
  const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const PITCHES = []; // built low -> high
  for (let o = 0; o <= 8; o++) {
    for (let i = 0; i < 12; i++) {
      PITCHES.push({ name: NOTE_NAMES[i] + o, isBlack: NOTE_NAMES[i].includes("#") });
      if (o === 8 && i === 0) break;
    }
  }
  PITCHES.reverse(); // top of piano = highest
  // Pitch → numeric rank (low=0, high=N) so chord notes can be sorted high→low.
  const PITCH_INDEX = {};
  PITCHES.slice().reverse().forEach((p, i) => { PITCH_INDEX[p.name] = i; });

  const WHITE_KEY_H = 30; // px per white key — drives total scrollable height

  const CHANNEL_PALETTE = [
    { color: "#e9925c", edge: "#c47338" }, // coral / bass
    { color: "#4ea6e9", edge: "#2d83c5" }, // blue / drum
    { color: "#6dc97a", edge: "#499b56" }, // green / lead
    { color: "#c47ccf", edge: "#985ba5" }, // magenta / chord
    { color: "#f0c04b", edge: "#c69829" }, // amber / pad
    { color: "#7e8dff", edge: "#5a6acc" }, // periwinkle / aux
    { color: "#ff7e9a", edge: "#cc5772" }, // rose
    { color: "#5cd3c6", edge: "#349a90" }, // teal
  ];

  // synth: how the preset's voice is built (mono = subtractive MonoSynth, fm = FMSynth,
  //   membrane = MembraneSynth for pitch-decay kicks/toms, metal = MetalSynth for cymbals,
  //   noise = NoiseSynth for snare/clap/FX, duo = DuoSynth for detuned-pair sounds).
  // poly: true → wrap the voice in Tone.PolySynth for chord-mode use.
  const PRESETS = {
    // -- Melodic / mono --
    bass:    { synth: "mono", osc: "sawtooth", attack: 0.02,  decay: 0.15, sustain: 0.7, release: 0.4  },
    lead:    { synth: "mono", osc: "square",   attack: 0.01,  decay: 0.10, sustain: 0.5, release: 0.3  },
    pluck:   { synth: "mono", osc: "triangle", attack: 0.005, decay: 0.05, sustain: 0.0, release: 0.15 },
    sub:     { synth: "mono", osc: "sine",     attack: 0.01,  decay: 0.20, sustain: 0.8, release: 0.40 },
    acid:    { synth: "mono", osc: "sawtooth", attack: 0.005, decay: 0.30, sustain: 0.2, release: 0.25 },
    reese:   { synth: "duo",                    attack: 0.01,  decay: 0.20, sustain: 0.7, release: 0.40 },

    // -- Melodic / poly --
    pad:     { synth: "mono", osc: "sine",     attack: 0.10,  decay: 0.20, sustain: 0.8, release: 0.8,  poly: true },
    keys:    { synth: "mono", osc: "triangle", attack: 0.005, decay: 0.20, sustain: 0.4, release: 0.8,  poly: true },
    bell:    { synth: "fm",   harmonicity: 8, modulationIndex: 14,
                              attack: 0.005, decay: 0.50, sustain: 0.0, release: 1.0, poly: true },
    marimba: { synth: "mono", osc: "sine",     attack: 0.005, decay: 0.40, sustain: 0.0, release: 0.40, poly: true },
    organ:   { synth: "mono", osc: "square",   attack: 0.005, decay: 0.10, sustain: 0.9, release: 0.30, poly: true },
    strings: { synth: "mono", osc: "sawtooth", attack: 0.30,  decay: 0.20, sustain: 0.7, release: 1.0,  poly: true },
    choir:   { synth: "mono", osc: "sawtooth", attack: 0.40,  decay: 0.30, sustain: 0.8, release: 1.5,  poly: true },

    // -- Drums --
    kick:    { synth: "membrane", osc: "sine", attack: 0.001, decay: 0.40, sustain: 0.0, release: 0.30, pitchDecay: 0.05, octaves: 10 },
    "808":   { synth: "membrane", osc: "sine", attack: 0.001, decay: 0.80, sustain: 0.0, release: 0.80, pitchDecay: 0.10, octaves: 6  },
    snare:   { synth: "noise", noise: "white", attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.05 },
    clap:    { synth: "noise", noise: "pink",  attack: 0.001, decay: 0.20, sustain: 0.0, release: 0.10 },
    hat:     { synth: "noise", noise: "white", attack: 0.001, decay: 0.04, sustain: 0.0, release: 0.04 },
    ohat:    { synth: "noise", noise: "white", attack: 0.001, decay: 0.25, sustain: 0.0, release: 0.18 },
    tom:     { synth: "membrane", osc: "sine", attack: 0.001, decay: 0.30, sustain: 0.0, release: 0.30, pitchDecay: 0.02, octaves: 4 },
    perc:    { synth: "membrane", osc: "sine", attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.10, pitchDecay: 0.005, octaves: 2 },
    rim:     { synth: "noise", noise: "white", attack: 0.001, decay: 0.04, sustain: 0.0, release: 0.03 },
    crash:   { synth: "metal", attack: 0.001,  decay: 1.5,                   release: 1.0, resonance: 4000 },
    ride:    { synth: "metal", attack: 0.001,  decay: 0.40,                  release: 0.20, resonance: 6000 },

    // -- FX --
    riser:   { synth: "noise", noise: "white", attack: 1.5,   decay: 0.50, sustain: 0.8, release: 0.30 },
    fx:      { synth: "noise", noise: "pink",  attack: 0.005, decay: 0.10, sustain: 0.0, release: 0.05 },
  };
  const PRESET_ORDER = [
    "bass", "lead", "pluck", "sub", "acid", "reese",
    "pad", "keys", "bell", "marimba", "organ", "strings", "choir",
    "kick", "808", "snare", "clap", "hat", "ohat", "tom", "perc", "rim", "crash", "ride",
    "riser", "fx",
  ];
  // Grouped view of PRESET_ORDER for the Preset tab in the Instrument popup.
  const PRESET_CATEGORIES = [
    { label: "Mono melodic", presets: ["bass","lead","pluck","sub","acid","reese"] },
    { label: "Poly melodic", presets: ["pad","keys","bell","marimba","organ","strings","choir"] },
    { label: "Drums",        presets: ["kick","808","snare","clap","hat","ohat","tom","perc","rim","crash","ride"] },
    { label: "FX",           presets: ["riser","fx"] },
  ];
  function isPolyPreset(name) { return !!(PRESETS[name] && PRESETS[name].poly); }
  function activePresetIsPoly() { return isPolyPreset(activeChannel().presetName); }

  // Size slider values: index → multiplier
  const SIZE_STEPS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];
  function sizeIndex(size) {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < SIZE_STEPS.length; i++) {
      const d = Math.abs(SIZE_STEPS[i] - size);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best;
  }
  function formatSize(size) {
    if (size === 0.25) return "¼";
    if (size === 0.5)  return "½";
    return String(size);
  }

  // Channel-level EQ + FX defaults. Both start fully dry (wet=0) so a new
  // channel sounds exactly like before, and the user only hears effects once
  // they turn the wet knob up. The 3-band EQ defaults to flat (0 dB on all).
  function defaultEQ() { return { low: 0, mid: 0, high: 0 }; }
  function defaultFX() {
    return {
      reverb:     { wet: 0, decay: 1.5 },
      delay:      { wet: 0, time: 0.25, feedback: 0.3 },
      chorus:     { wet: 0, freq: 1.5, depth: 0.7 },
      distortion: { wet: 0, amount: 0.4 },
    };
  }
  // Voice timbre: external lowpass filter (cutoff/resonance), MonoSynth filter
  // envelope depth (filterEnv, octaves of upward sweep), stereo pan, and glide
  // (portamento time, in seconds, for synths that support it).
  // Defaults are "transparent": cutoff wide open, Q low, no pan, no glide.
  function defaultTone() {
    return { cutoff: 12000, resonance: 1, filterEnv: 3, pan: 0, glide: 0 };
  }
  // Fills in any missing eq/fx fields on a channel object (e.g. ones restored
  // from a snapshot created before these existed, or returned from clone).
  function ensureChannelDefaults(ch) {
    if (!ch.eq) ch.eq = defaultEQ();
    else { const d = defaultEQ(); for (const k in d) if (ch.eq[k] === undefined) ch.eq[k] = d[k]; }
    if (!ch.fx) ch.fx = defaultFX();
    else {
      const d = defaultFX();
      for (const e of ["reverb","delay","chorus","distortion"]) {
        if (!ch.fx[e]) ch.fx[e] = d[e];
        else for (const k in d[e]) if (ch.fx[e][k] === undefined) ch.fx[e][k] = d[e][k];
      }
    }
    if (!ch.tone) ch.tone = defaultTone();
    else { const d = defaultTone(); for (const k in d) if (ch.tone[k] === undefined) ch.tone[k] = d[k]; }
    return ch;
  }

  const state = {
    steps: 16,
    cursor: 0,
    playhead: null,           // fractional step during playback; null when stopped
    notes: [],                // {id, step, size, pitch}
    selectedId: null,
    multiSelect: false,
    selectedIds: new Set(),   // active in multi-select mode
    rangeSelectAnchor: null,  // step where a range selection began (input channel only)
    chordMode: false,         // true while building a multi-pitch chord at chordStep
    chordStep: null,          // step the chord is being built at
    clipboard: null,          // [{relStep, pitch, size}] anchored at top-most copied step
    playing: false,
    nextId: 1,
    defaultSize: 1,
    snap: "step",
    keyboardZoom: 1.0,
    scaleOn: false,
    scaleRoot: "C",
    scaleType: "major",
    channels: [
      { id: 1, name: "Bass",  color: CHANNEL_PALETTE[0].color, edge: CHANNEL_PALETTE[0].edge, presetName: "bass",  muted: false, volume: 0.8, adsr: { attack: 0.02,  decay: 0.15, sustain: 0.7, release: 0.4  }, eq: defaultEQ(), fx: defaultFX(), tone: defaultTone() },
      { id: 2, name: "Drum",  color: CHANNEL_PALETTE[1].color, edge: CHANNEL_PALETTE[1].edge, presetName: "pluck", muted: false, volume: 0.8, adsr: { attack: 0.005, decay: 0.05, sustain: 0.0, release: 0.15 }, eq: defaultEQ(), fx: defaultFX(), tone: defaultTone() },
      { id: 3, name: "Lead",  color: CHANNEL_PALETTE[2].color, edge: CHANNEL_PALETTE[2].edge, presetName: "lead",  muted: false, volume: 0.8, adsr: { attack: 0.01,  decay: 0.10, sustain: 0.5, release: 0.3  }, eq: defaultEQ(), fx: defaultFX(), tone: defaultTone() },
      { id: 4, name: "Chord", color: CHANNEL_PALETTE[3].color, edge: CHANNEL_PALETTE[3].edge, presetName: "pad",   muted: false, volume: 0.8, adsr: { attack: 0.10,  decay: 0.20, sustain: 0.8, release: 0.8  }, eq: defaultEQ(), fx: defaultFX(), tone: defaultTone() },
    ],
    activeChannelId: 1,
    nextChannelId: 5,
  };

  function activeChannel() { return state.channels.find(c => c.id === state.activeChannelId) || state.channels[0]; }
  function activeNotes() { return state.notes.filter(n => n.channelId === state.activeChannelId); }

  // ---------- Undo / Redo ----------
  // Snapshot-based: every mutating user action calls pushUndo() before it
  // mutates state. Undo/Redo swap snapshots between the two stacks and
  // re-render. ADSR/volume sliders push once per "session" (debounced).
  const UNDO_LIMIT = 80;
  const undoStack = [];
  const redoStack = [];
  function snapshotState() {
    return JSON.stringify({
      notes: state.notes,
      channels: state.channels,
      activeChannelId: state.activeChannelId,
      steps: state.steps,
      nextId: state.nextId,
      nextChannelId: state.nextChannelId,
    });
  }
  function applySnapshot(json) {
    const s = JSON.parse(json);
    state.notes = s.notes;
    state.channels = s.channels.map(ensureChannelDefaults);
    state.activeChannelId = s.activeChannelId;
    state.steps = s.steps;
    state.nextId = s.nextId;
    state.nextChannelId = s.nextChannelId;
    // Selection / chord / range state is volatile UI state — clear so the
    // restored grid doesn't reference notes that no longer exist.
    state.selectedId = null;
    state.multiSelect = false;
    state.selectedIds.clear();
    state.rangeSelectAnchor = null;
    state.chordMode = false;
    state.chordStep = null;
    // Channel set may have changed; drop synths for channels that no longer
    // exist so makeSynth runs fresh next time.
    const liveIds = new Set(state.channels.map(c => c.id));
    [...Object.keys(channelSynths), ...Object.keys(channelChains)].forEach(id => {
      if (!liveIds.has(+id)) disposeChannelSynth(+id);
    });
    // Per-channel synths whose preset/adsr/eq/fx might have changed: rebuild.
    state.channels.forEach(ch => disposeChannelSynth(ch.id));
    if (lengthEl) { lengthEl.value = state.steps; lengthValEl.textContent = state.steps; }
    applyActiveChannelStyle();
    renderChannelStrip();
    renderPresetButtons();
    syncInsPopup();
    renderGrid();
    positionKnobFromCursor();
    updateSelectedBar();
    refreshKeyHighlights();
  }
  function pushUndo() {
    undoStack.push(snapshotState());
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
    if (options.onChange) queueMicrotask(() => options.onChange(JSON.parse(snapshotState())));
  }
  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotState());
    applySnapshot(undoStack.pop());
    updateUndoButtons();
  }
  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotState());
    applySnapshot(redoStack.pop());
    updateUndoButtons();
  }
  function updateUndoButtons() {
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  function formatStep(stepFloat) {
    const oneBased = stepFloat + 1;
    if (Math.abs(oneBased - Math.round(oneBased)) < 1e-6) {
      return String(Math.round(oneBased)).padStart(2, "0");
    }
    if (Math.abs(oneBased * 2 - Math.round(oneBased * 2)) < 1e-6) {
      return String(Math.floor(oneBased)).padStart(2, "0") + "½";
    }
    return oneBased.toFixed(2);
  }

  const SCALE_OFFSETS = {
    major: [0,2,4,5,7,9,11],
    minor: [0,2,3,5,7,8,10],
    "pent-major": [0,2,4,7,9],
    "pent-minor": [0,3,5,7,10],
  };
  const NOTE_INDEX = { C:0, "C#":1, D:2, "D#":3, E:4, F:5, "F#":6, G:7, "G#":8, A:9, "A#":10, B:11 };
  const INDEX_NOTE = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  // ---------- DOM refs ----------
  const $ = (id) => root.querySelector("#"+id);
  const keysEl = $("keys"), gridEl = $("grid"), knobEl = $("knob"), scrollerEl = $("scroller");
  const lengthEl = $("length"), lengthValEl = $("lengthVal");
  const defaultSizeEl = $("defaultSize"), defaultSizeValEl = $("defaultSizeVal");
  const zoomEl = $("zoom"), zoomValEl = $("zoomVal");
  const deleteBtn = $("deleteBtn"), moveBtn = $("moveBtn");
  const paramsRow = $("paramsRow");
  const volVal = $("volVal"), lenVal = $("lenVal");
  const aVal = $("aVal"), dVal = $("dVal"), sVal = $("sVal"), rVal = $("rVal");
  const eqLowPill  = $("eqLowPill"),  eqMidPill = $("eqMidPill"),  eqHighPill = $("eqHighPill");
  const reverbPill = $("reverbPill"), delayPill = $("delayPill"),
        chorusPill = $("chorusPill"), distPill  = $("distPill");
  const cutoffPill = $("cutoffPill"), resPill   = $("resPill"),
        envPill    = $("envPill"),    panPill   = $("panPill"), glidePill = $("glidePill");
  const copyBtn = $("copyBtn"), multiDeleteBtn = $("multiDeleteBtn"), doneBtn = $("doneBtn");
  const pasteBtn = $("pasteBtn");
  const playBtn = $("playBtn"), stopBtn = $("stopBtn");
  const undoBtn = $("undoBtn"), redoBtn = $("redoBtn");
  const stackScroller = $("stackScroller"), stackNav = $("stackNav");
  const floatingDelete = $("floatingDelete");
  const attackEl = $("attack"), decayEl = $("decay"), sustainEl = $("sustain"), releaseEl = $("release");
  const volumeEl = $("volume"), volumeV = $("volumeV");
  // EQ + FX slider refs (Instrument popup, EQ + FX tabs).
  const eqLowEl  = $("eqLow"),  eqMidEl  = $("eqMid"),  eqHighEl = $("eqHigh");
  const eqLowV   = $("eqLowV"), eqMidV   = $("eqMidV"), eqHighV  = $("eqHighV");
  const reverbWetEl = $("reverbWet"),   reverbWetV   = $("reverbWetV");
  const reverbDecayEl = $("reverbDecay"), reverbDecayV = $("reverbDecayV");
  const delayWetEl  = $("delayWet"),    delayWetV    = $("delayWetV");
  const delayTimeEl = $("delayTime"),   delayTimeV   = $("delayTimeV");
  const delayFbEl   = $("delayFb"),     delayFbV     = $("delayFbV");
  const chorusWetEl = $("chorusWet"),   chorusWetV   = $("chorusWetV");
  const chorusFreqEl = $("chorusFreq"), chorusFreqV  = $("chorusFreqV");
  const chorusDepthEl = $("chorusDepth"), chorusDepthV = $("chorusDepthV");
  const distWetEl   = $("distWet"),     distWetV     = $("distWetV");
  const distAmtEl   = $("distAmt"),     distAmtV     = $("distAmtV");
  // Tone tab sliders (cutoff, resonance, filter envelope depth, pan, glide).
  const cutoffEl    = $("cutoff"),      cutoffV      = $("cutoffV");
  const resEl       = $("res"),         resV         = $("resV");
  const filterEnvEl = $("filterEnv"),   filterEnvV   = $("filterEnvV");
  const panEl       = $("pan"),         panV         = $("panV");
  const glideEl     = $("glide"),       glideV       = $("glideV");
  const adsrV = { attack: $("attackV"), decay: $("decayV"), sustain: $("sustainV"), release: $("releaseV") };

  // ---------- Audio (per-channel synths) ----------
  // Two parallel maps:
  //   channelSynths[id] — the voice (MonoSynth, MembraneSynth, etc.)
  //   channelChains[id] — the effects nodes that voice flows through
  //                       (EQ3 → Distortion → Chorus → FeedbackDelay → Reverb)
  // makeSynth builds both and wires them; disposeChannelSynth tears both down.
  const channelSynths = {};
  const channelChains = {};

  function makeSynth(channel) {
    ensureChannelDefaults(channel);
    const p = PRESETS[channel.presetName] || PRESETS.bass;
    const env = {
      attack:  channel.adsr.attack,
      decay:   channel.adsr.decay,
      sustain: channel.adsr.sustain,
      release: channel.adsr.release,
    };
    let s;
    switch (p.synth) {
      case "membrane":
        s = new Tone.MembraneSynth({
          oscillator: { type: p.osc || "sine" },
          envelope: env,
          pitchDecay: p.pitchDecay ?? 0.05,
          octaves: p.octaves ?? 10,
        });
        break;
      case "metal":
        s = new Tone.MetalSynth({
          envelope: { attack: env.attack, decay: env.decay, release: env.release },
          harmonicity: p.harmonicity ?? 5.1,
          modulationIndex: p.modulationIndex ?? 16,
          resonance: p.resonance ?? 4000,
          octaves: p.octaves ?? 1.5,
        });
        break;
      case "noise":
        s = new Tone.NoiseSynth({
          noise: { type: p.noise || "white" },
          envelope: env,
        });
        break;
      case "fm": {
        const opts = {
          harmonicity: p.harmonicity ?? 3,
          modulationIndex: p.modulationIndex ?? 10,
          envelope: env,
        };
        s = p.poly
          ? new Tone.PolySynth(Tone.FMSynth, opts)
          : new Tone.FMSynth(opts);
        break;
      }
      case "duo":
        s = new Tone.DuoSynth({
          harmonicity: 0.99,
          vibratoAmount: 0,
        });
        break;
      case "mono":
      default: {
        const opts = {
          oscillator: { type: p.osc || "sawtooth" },
          envelope: env,
          filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.5, baseFrequency: 220, octaves: 3 },
        };
        s = p.poly
          ? new Tone.PolySynth(Tone.MonoSynth, opts)
          : new Tone.MonoSynth(opts);
      }
    }
    s.volume.value = -10;

    // Build the effects chain. All effects start fully dry (wet=0) so the
    // default sound is unchanged; the user only hears effects once they
    // dial up the wet knob in the popup or the FX stack.
    // An external lowpass Filter + stereo Panner give every channel a Tone
    // surface (cutoff/res/pan) regardless of which synth class it uses.
    const filter     = new Tone.Filter(channel.tone.cutoff, "lowpass");
    filter.Q.value   = channel.tone.resonance;
    const eq         = new Tone.EQ3(0, 0, 0);
    const distortion = new Tone.Distortion(channel.fx.distortion.amount);
    const chorus     = new Tone.Chorus(channel.fx.chorus.freq, 2.5, channel.fx.chorus.depth).start();
    const delay      = new Tone.FeedbackDelay(channel.fx.delay.time, channel.fx.delay.feedback);
    const reverb     = new Tone.Reverb(channel.fx.reverb.decay);
    const panner     = new Tone.Panner(channel.tone.pan);
    distortion.wet.value = channel.fx.distortion.wet;
    chorus.wet.value     = channel.fx.chorus.wet;
    delay.wet.value      = channel.fx.delay.wet;
    reverb.wet.value     = channel.fx.reverb.wet;
    s.chain(filter, eq, distortion, chorus, delay, reverb, panner, Tone.Destination);
    const chain = { filter, eq, distortion, chorus, delay, reverb, panner };
    channelChains[channel.id] = chain;
    applyChannelEQ(chain, channel.eq);
    applyChannelTone(s, chain, channel.tone);
    return s;
  }
  // Apply the channel's Tone settings to both the external filter+panner
  // (universal — works on any synth class) and the synth-internal bits that
  // only MonoSynth-family voices respond to (filterEnvelope.octaves, glide).
  function applyChannelTone(synth, chain, tone) {
    if (chain) {
      if (chain.filter) {
        chain.filter.frequency.value = tone.cutoff;
        chain.filter.Q.value         = tone.resonance;
      }
      if (chain.panner) chain.panner.pan.value = tone.pan;
    }
    if (!synth) return;
    // filterEnvelope.octaves only exists on MonoSynth (incl. PolySynth(MonoSynth)).
    try { synth.set({ filterEnvelope: { octaves: tone.filterEnv } }); } catch (_) {}
    // Portamento works on MonoSynth / FMSynth / DuoSynth; harmless to set even
    // when ignored, but guard against synths that lack the field.
    try { if ("portamento" in synth) synth.portamento = tone.glide; } catch (_) {}
  }
  function applyChannelEQ(chain, eq) {
    if (!chain || !eq) return;
    chain.eq.low.value  = eq.low;
    chain.eq.mid.value  = eq.mid;
    chain.eq.high.value = eq.high;
  }
  function applyChannelFX(chain, fx) {
    if (!chain || !fx) return;
    chain.reverb.wet.value     = fx.reverb.wet;
    // Tone.Reverb.decay can't be set on a live node in some versions — guard.
    try { chain.reverb.decay = fx.reverb.decay; } catch (_) {}
    chain.delay.wet.value      = fx.delay.wet;
    chain.delay.delayTime.value = fx.delay.time;
    chain.delay.feedback.value  = fx.delay.feedback;
    chain.chorus.wet.value      = fx.chorus.wet;
    chain.chorus.frequency.value = fx.chorus.freq;
    chain.chorus.depth          = fx.chorus.depth;
    chain.distortion.wet.value  = fx.distortion.wet;
    chain.distortion.distortion = fx.distortion.amount;
  }
  // Broadcasts an envelope to whatever synth class is at hand. Drum-class
  // synths (MetalSynth, NoiseSynth, MembraneSynth) are deliberately skipped:
  // their preset envelopes are tuned at construction and forcing sustain=0
  // (the channel default for unpitched presets) collapses MetalSynth hits to
  // silence before the decay actually plays. Per-note ADSR pills therefore
  // don't apply to drum channels — acceptable trade-off since drums sound off
  // their built-in envelope shape anyway.
  function setSynthEnvelope(s, env) {
    if (s instanceof Tone.MetalSynth
        || s instanceof Tone.NoiseSynth
        || s instanceof Tone.MembraneSynth) return;
    try { s.set({ envelope: env }); } catch (_) {}
  }

  // NoiseSynth and MetalSynth don't take a pitch argument the way MonoSynth /
  // FMSynth / MembraneSynth do. This helper normalises the call so the rest of
  // the playback / preview path can stay pitch-first.
  //
  // Drum-class synths (MembraneSynth, MetalSynth, NoiseSynth) ignore the grid
  // duration: their tuned envelope IS the sound, and gating triggerAttackRelease
  // to a single 16n step (~0.125s at 120 BPM) cuts the natural decay off
  // mid-hit — that's why short perc/hat/snare hits sounded silent or clipped
  // during playback while previews (which pass "8n") sounded fine.
  function triggerSynth(s, pitch, dur, time, velocity) {
    if (s instanceof Tone.NoiseSynth) {
      s.triggerAttackRelease("8n", time, velocity);
    } else if (s instanceof Tone.MetalSynth) {
      // MetalSynth ignores pitch internally but accepts the same call shape.
      s.triggerAttackRelease("8n", time, velocity);
    } else if (s instanceof Tone.MembraneSynth) {
      s.triggerAttackRelease(pitch, "8n", time, velocity);
    } else {
      s.triggerAttackRelease(pitch, dur, time, velocity);
    }
  }
  function getSynth(channelId) {
    if (!channelSynths[channelId]) {
      const ch = state.channels.find(c => c.id === channelId);
      if (ch) {
        try { channelSynths[channelId] = makeSynth(ch); }
        catch (err) { console.error("Synth init failed for channel", channelId, err); return null; }
      }
    }
    return channelSynths[channelId];
  }
  function disposeChannelSynth(channelId) {
    if (channelSynths[channelId]) {
      try { channelSynths[channelId].dispose(); } catch (_) {}
      delete channelSynths[channelId];
    }
    const chain = channelChains[channelId];
    if (chain) {
      Object.values(chain).forEach(node => { try { node.dispose(); } catch (_) {} });
      delete channelChains[channelId];
    }
  }

  function previewNote(n) {
    Tone.start();
    const s = getSynth(n.channelId);
    if (!s) return;
    setSynthEnvelope(s, {
      attack:  effectiveProp(n, "attack"),
      decay:   effectiveProp(n, "decay"),
      sustain: effectiveProp(n, "sustain"),
      release: effectiveProp(n, "release"),
    });
    // Apply this note's effective EQ + FX to the channel's chain so the
    // preview reflects per-note overrides. Channel defaults are used for
    // bands / effects the note hasn't customised.
    const chain = channelChains[n.channelId];
    if (chain) {
      applyChannelEQ(chain, effectiveEQ(n));
      applyChannelFX(chain, effectiveFX(n));
      applyChannelTone(s, chain, effectiveTone(n));
    }
    triggerSynth(s, n.pitch, "8n", undefined, effectiveProp(n, "volume"));
  }

  function applyADSR() {
    const ch = activeChannel();
    ch.adsr.attack  = +attackEl.value;
    ch.adsr.decay   = +decayEl.value;
    ch.adsr.sustain = +sustainEl.value;
    ch.adsr.release = +releaseEl.value;
    ch.volume       = +volumeEl.value;
    const s = getSynth(ch.id);
    if (s) setSynthEnvelope(s, ch.adsr);
    adsrV.attack.textContent  = ch.adsr.attack.toFixed(2);
    adsrV.decay.textContent   = ch.adsr.decay.toFixed(2);
    adsrV.sustain.textContent = ch.adsr.sustain.toFixed(2);
    adsrV.release.textContent = ch.adsr.release.toFixed(2);
    volumeV.textContent       = ch.volume.toFixed(2);
    // Re-sync the param pills so the new channel default shows up immediately
    // (both selected-note overrides and the no-selection fallback).
    syncParamPills();
  }
  // Debounced preview tick so the user hears the new envelope/volume right
  // after they finish moving a slider. Firing on every `input` event would
  // overlap dozens of hits during a single drag.
  let adsrPreviewTimer = null;
  function scheduleAdsrPreview() {
    if (adsrPreviewTimer) clearTimeout(adsrPreviewTimer);
    adsrPreviewTimer = setTimeout(() => {
      adsrPreviewTimer = null;
      const ch = activeChannel();
      const s = getSynth(ch.id);
      if (!s) return;
      Tone.start();
      triggerSynth(s, "C4", "8n", undefined, ch.volume ?? 0.8);
    }, 150);
  }
  // Continuous sliders fire `input` on every tick — one undo entry per tick
  // would let the user "undo" twenty times to step back through one drag.
  // beginSliderSession() pushes ONE snapshot on first input, then waits for
  // ~800ms of silence before considering the next drag a fresh undo step.
  const sliderSessions = new WeakMap();
  function beginSliderSession(key) {
    const sess = sliderSessions.get(key) || { active: false, timer: null };
    if (!sess.active) { pushUndo(); sess.active = true; }
    if (sess.timer) clearTimeout(sess.timer);
    sess.timer = setTimeout(() => { sess.active = false; sess.timer = null; }, 800);
    sliderSessions.set(key, sess);
  }
  [attackEl, decayEl, sustainEl, releaseEl, volumeEl].forEach(el => {
    el.addEventListener("input", () => beginSliderSession(el));
    el.addEventListener("input", applyADSR);
    el.addEventListener("input", scheduleAdsrPreview);
  });

  // --- EQ slider input ---
  function applyEqInputs() {
    const ch = activeChannel();
    ch.eq.low  = +eqLowEl.value;
    ch.eq.mid  = +eqMidEl.value;
    ch.eq.high = +eqHighEl.value;
    eqLowV.textContent  = fmtDb(ch.eq.low);
    eqMidV.textContent  = fmtDb(ch.eq.mid);
    eqHighV.textContent = fmtDb(ch.eq.high);
    applyChannelEQ(channelChains[ch.id], ch.eq);
    syncEqFxPills();
  }
  [eqLowEl, eqMidEl, eqHighEl].forEach(el => {
    el.addEventListener("input", () => beginSliderSession(el));
    el.addEventListener("input", applyEqInputs);
    el.addEventListener("input", scheduleAdsrPreview);
  });

  // --- FX slider inputs ---
  function applyFxInputs() {
    const ch = activeChannel();
    ch.fx.reverb.wet     = +reverbWetEl.value;
    ch.fx.reverb.decay   = +reverbDecayEl.value;
    ch.fx.delay.wet      = +delayWetEl.value;
    ch.fx.delay.time     = +delayTimeEl.value;
    ch.fx.delay.feedback = +delayFbEl.value;
    ch.fx.chorus.wet     = +chorusWetEl.value;
    ch.fx.chorus.freq    = +chorusFreqEl.value;
    ch.fx.chorus.depth   = +chorusDepthEl.value;
    ch.fx.distortion.wet    = +distWetEl.value;
    ch.fx.distortion.amount = +distAmtEl.value;
    reverbWetV.textContent   = fmtPct(ch.fx.reverb.wet);
    reverbDecayV.textContent = ch.fx.reverb.decay.toFixed(1) + " s";
    delayWetV.textContent    = fmtPct(ch.fx.delay.wet);
    delayTimeV.textContent   = ch.fx.delay.time.toFixed(2) + " s";
    delayFbV.textContent     = fmtPct(ch.fx.delay.feedback);
    chorusWetV.textContent   = fmtPct(ch.fx.chorus.wet);
    chorusFreqV.textContent  = ch.fx.chorus.freq.toFixed(1) + " Hz";
    chorusDepthV.textContent = ch.fx.chorus.depth.toFixed(2);
    distWetV.textContent     = fmtPct(ch.fx.distortion.wet);
    distAmtV.textContent     = ch.fx.distortion.amount.toFixed(2);
    applyChannelFX(channelChains[ch.id], ch.fx);
    syncEqFxPills();
  }
  [reverbWetEl, reverbDecayEl, delayWetEl, delayTimeEl, delayFbEl,
   chorusWetEl, chorusFreqEl, chorusDepthEl, distWetEl, distAmtEl
  ].forEach(el => {
    el.addEventListener("input", () => beginSliderSession(el));
    el.addEventListener("input", applyFxInputs);
    el.addEventListener("input", scheduleAdsrPreview);
  });

  // --- Tone slider inputs ---
  function applyToneInputs() {
    const ch = activeChannel();
    ch.tone.cutoff    = +cutoffEl.value;
    ch.tone.resonance = +resEl.value;
    ch.tone.filterEnv = +filterEnvEl.value;
    ch.tone.pan       = +panEl.value;
    ch.tone.glide     = +glideEl.value;
    cutoffV.textContent    = fmtHz(ch.tone.cutoff) + " Hz";
    resV.textContent       = ch.tone.resonance.toFixed(1);
    filterEnvV.textContent = ch.tone.filterEnv.toFixed(1) + " oct";
    panV.textContent       = fmtPan(ch.tone.pan);
    glideV.textContent     = fmtGlide(ch.tone.glide);
    applyChannelTone(channelSynths[ch.id], channelChains[ch.id], ch.tone);
    syncTonePills();
  }
  [cutoffEl, resEl, filterEnvEl, panEl, glideEl].forEach(el => {
    el.addEventListener("input", () => beginSliderSession(el));
    el.addEventListener("input", applyToneInputs);
    el.addEventListener("input", scheduleAdsrPreview);
  });

  function syncInsPopup() {
    const ch = ensureChannelDefaults(activeChannel());
    attackEl.value  = ch.adsr.attack;
    decayEl.value   = ch.adsr.decay;
    sustainEl.value = ch.adsr.sustain;
    releaseEl.value = ch.adsr.release;
    volumeEl.value  = ch.volume ?? 0.8;
    adsrV.attack.textContent  = ch.adsr.attack.toFixed(2);
    adsrV.decay.textContent   = ch.adsr.decay.toFixed(2);
    adsrV.sustain.textContent = ch.adsr.sustain.toFixed(2);
    adsrV.release.textContent = ch.adsr.release.toFixed(2);
    volumeV.textContent       = (ch.volume ?? 0.8).toFixed(2);

    // EQ
    eqLowEl.value  = ch.eq.low;  eqLowV.textContent  = fmtDb(ch.eq.low);
    eqMidEl.value  = ch.eq.mid;  eqMidV.textContent  = fmtDb(ch.eq.mid);
    eqHighEl.value = ch.eq.high; eqHighV.textContent = fmtDb(ch.eq.high);

    // FX
    reverbWetEl.value  = ch.fx.reverb.wet;       reverbWetV.textContent   = fmtPct(ch.fx.reverb.wet);
    reverbDecayEl.value = ch.fx.reverb.decay;    reverbDecayV.textContent = ch.fx.reverb.decay.toFixed(1) + " s";
    delayWetEl.value   = ch.fx.delay.wet;        delayWetV.textContent    = fmtPct(ch.fx.delay.wet);
    delayTimeEl.value  = ch.fx.delay.time;       delayTimeV.textContent   = ch.fx.delay.time.toFixed(2) + " s";
    delayFbEl.value    = ch.fx.delay.feedback;   delayFbV.textContent     = fmtPct(ch.fx.delay.feedback);
    chorusWetEl.value  = ch.fx.chorus.wet;       chorusWetV.textContent   = fmtPct(ch.fx.chorus.wet);
    chorusFreqEl.value = ch.fx.chorus.freq;      chorusFreqV.textContent  = ch.fx.chorus.freq.toFixed(1) + " Hz";
    chorusDepthEl.value = ch.fx.chorus.depth;    chorusDepthV.textContent = ch.fx.chorus.depth.toFixed(2);
    distWetEl.value    = ch.fx.distortion.wet;   distWetV.textContent     = fmtPct(ch.fx.distortion.wet);
    distAmtEl.value    = ch.fx.distortion.amount;distAmtV.textContent     = ch.fx.distortion.amount.toFixed(2);

    // Tone
    cutoffEl.value    = ch.tone.cutoff;    cutoffV.textContent    = fmtHz(ch.tone.cutoff) + " Hz";
    resEl.value       = ch.tone.resonance; resV.textContent       = ch.tone.resonance.toFixed(1);
    filterEnvEl.value = ch.tone.filterEnv; filterEnvV.textContent = ch.tone.filterEnv.toFixed(1) + " oct";
    panEl.value       = ch.tone.pan;       panV.textContent       = fmtPan(ch.tone.pan);
    glideEl.value     = ch.tone.glide;     glideV.textContent     = fmtGlide(ch.tone.glide);

    syncEqFxPills();
    // The preset segments live in #presetGroups now; renderPresetButtons sets
    // the active class on each render.
    renderPresetButtons();
  }
  function fmtDb(v)  { return (v > 0 ? "+" : "") + Number(v).toFixed(1); }
  function fmtPct(v) { return Math.round(Number(v) * 100) + "%"; }

  // ---------- Piano render ----------
  function getInScaleClasses() {
    const root = NOTE_INDEX[state.scaleRoot] || 0;
    const offsets = SCALE_OFFSETS[state.scaleType] || SCALE_OFFSETS.major;
    return new Set(offsets.map(o => INDEX_NOTE[(root + o) % 12]));
  }

  function refreshKeyHighlights() {
    keysEl.querySelectorAll(".key").forEach(k => {
      k.classList.remove("in-scale");
      k.classList.remove("chord-active");
      k.classList.remove("cursor-pitch");
    });
    if (state.scaleOn) {
      const inScale = getInScaleClasses();
      keysEl.querySelectorAll(".key").forEach(k => {
        const cls = k.dataset.pitch.replace(/[0-9]/g, "");
        if (inScale.has(cls)) k.classList.add("in-scale");
      });
    }
    const ch = state.activeChannelId;
    if (state.chordMode) {
      // Chord mode: strong purple highlight on every pitch currently in the chord.
      const pitches = new Set(state.notes
        .filter(n => n.channelId === ch && Math.abs(n.step - state.chordStep) < 1e-6)
        .map(n => n.pitch));
      keysEl.querySelectorAll(".key").forEach(k => {
        if (pitches.has(k.dataset.pitch)) k.classList.add("chord-active");
      });
    } else {
      // Normal mode: softer "cursor-pitch" hint on any pitch the cursor is sitting on
      // in the input channel — accounts for a note's full duration (step → step + size).
      const c = state.cursor;
      const pitches = new Set(state.notes
        .filter(n => n.channelId === ch && c >= n.step - 1e-6 && c < n.step + n.size - 1e-6)
        .map(n => n.pitch));
      keysEl.querySelectorAll(".key").forEach(k => {
        if (pitches.has(k.dataset.pitch)) k.classList.add("cursor-pitch");
      });
    }
  }

  function renderKeys() {
    keysEl.innerHTML = "";
    const whites = PITCHES.filter(p => !p.isBlack);
    const wh = WHITE_KEY_H * state.keyboardZoom;
    keysEl.style.height = (whites.length * wh) + "px";
    const layout = {};
    let wi = 0;
    PITCHES.forEach(p => {
      if (!p.isBlack) { layout[p.name] = { top: wi * wh, h: wh, black: false }; wi++; }
    });
    PITCHES.forEach((p, idx) => {
      if (!p.isBlack) return;
      const prev = PITCHES[idx - 1];
      if (prev && !prev.isBlack) {
        const L = layout[prev.name];
        layout[p.name] = { top: L.top + L.h * 0.65, h: wh * 0.62, black: true };
      }
    });

    PITCHES.forEach(p => {
      if (p.isBlack) return;
      const el = document.createElement("div");
      el.className = "key white";
      if (p.name.startsWith("C") && !p.name.includes("#")) el.classList.add("octave-label");
      el.textContent = p.name;
      el.dataset.pitch = p.name;
      const L = layout[p.name];
      el.style.top = L.top + "px"; el.style.height = L.h + "px";
      attachPianoKeyGesture(el, p.name, false);
      keysEl.appendChild(el);
    });
    PITCHES.forEach(p => {
      if (!p.isBlack || !layout[p.name]) return;
      const el = document.createElement("div");
      el.className = "key black";
      el.dataset.pitch = p.name;
      const L = layout[p.name];
      el.style.top = L.top + "px"; el.style.height = L.h + "px";
      attachPianoKeyGesture(el, p.name, true);
      keysEl.appendChild(el);
    });
    refreshKeyHighlights();
  }

  function attachPianoKeyGesture(el, pitch, isBlack) {
    let suppress = false;
    // iOS Safari doesn't synthesize `click` for a second simultaneous
    // touch — only pointerdown/pointerup fire. We detect taps via
    // pointerup (short, small-movement touch cycle) so placing notes
    // works while the cursor knob is being dragged with the other hand.
    let tapStart = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      tapStart = { x: e.clientX, y: e.clientY, id: e.pointerId };

      // Long-press on a poly-channel key arms chord mode at the cursor.
      if (state.chordMode || !activePresetIsPoly()) return;
      const sx = e.clientX, sy = e.clientY;
      el.classList.add("charging");
      let timer = setTimeout(() => {
        timer = null;
        el.classList.remove("charging");
        el.classList.add("charge-complete");
        setTimeout(() => el.classList.remove("charge-complete"), 360);
        suppress = true;
        enterChordMode(pitch);
      }, CHORD_LONG_PRESS_MS);
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; el.classList.remove("charging"); } };
      const onMove = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cancel(); };
      const onUp = (ev) => {
        cancel();
        // Detect tap: same pointer, didn't move much, long-press didn't fire.
        if (tapStart && tapStart.id === ev.pointerId) {
          const dx = ev.clientX - tapStart.x;
          const dy = ev.clientY - tapStart.y;
          tapStart = null;
          if (Math.hypot(dx, dy) < 10 && !suppress) {
            if (isBlack) ev.stopPropagation();
            onKeyPress(pitch, el);
          }
          if (suppress) suppress = false;
        }
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
    // For mono channels the pointerdown early-returns before the long-
    // press setup, so the onUp above never gets attached. Register a
    // permanent pointerup handler for that code path.
    el.addEventListener("pointerup", (e) => {
      if (!tapStart || tapStart.id !== e.pointerId) return;
      const dx = e.clientX - tapStart.x;
      const dy = e.clientY - tapStart.y;
      tapStart = null;
      if (Math.hypot(dx, dy) < 10 && !suppress) {
        if (isBlack) e.stopPropagation();
        onKeyPress(pitch, el);
      }
      if (suppress) suppress = false;
    });
  }

  // ---------- Cursor mini-menu + range selection ----------
  function openCursorMenu(e) {
    e.stopPropagation();
    closeCursorMenu();
    const menu = document.createElement("div");
    menu.className = "cursor-menu";
    menu.id = "cursorMenu";
    menu.dataset.seqPopover = "1";

    const selBtn = document.createElement("button");
    selBtn.type = "button";
    selBtn.textContent = state.rangeSelectAnchor === null ? "Selection" : "Cancel selection";
    selBtn.addEventListener("click", () => {
      closeCursorMenu();
      if (state.rangeSelectAnchor === null) startRangeSelect();
      else cancelRangeSelect();
    });
    menu.appendChild(selBtn);

    // "Chord" entry — only meaningful on poly channels (a MonoSynth can't play chords).
    if (activePresetIsPoly()) {
      const chordBtn = document.createElement("button");
      chordBtn.type = "button";
      chordBtn.textContent = state.chordMode ? "Exit chord" : "Chord";
      chordBtn.addEventListener("click", () => {
        closeCursorMenu();
        if (state.chordMode) exitChordMode();
        else {
          state.chordMode = true;
          state.chordStep = effectivePlacementStep();
          refreshKeyHighlights();
          renderGrid();
          updateSelectedBar();
        }
      });
      menu.appendChild(chordBtn);
    }

    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.textContent = "Settings";
    settingsBtn.addEventListener("click", () => {
      closeCursorMenu();
      openSequencerPopup();
    });
    menu.appendChild(settingsBtn);

    const r = e.currentTarget.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + "px";
    menu.style.left = (r.left) + "px";
    // Wrap the menu in a fullscreen overlay. Clicking the overlay (where
    // the click target is the overlay itself rather than the menu inside)
    // closes the menu. Click is the most reliable dismiss path on iOS:
    // pointerdown can be dropped during gesture recognition.
    const overlay = document.createElement("div");
    overlay.className = "seq-menu-overlay";
    overlay.id = "cursorMenuOverlay";
    overlay.dataset.seqPopover = "1";
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) closeCursorMenu();
    });
    overlay.appendChild(menu);
    document.body.appendChild(overlay);
  }
  function closeCursorMenu() {
    const o = root.querySelector("#"+"cursorMenuOverlay");
    if (o) o.remove();
    // Defensive sweep for any orphans from earlier code paths.
    const m = root.querySelector("#"+"cursorMenu");
    if (m && !m.closest(".seq-menu-overlay")) m.remove();
  }
  function startRangeSelect() {
    state.rangeSelectAnchor = state.cursor;
    state.multiSelect = true;
    state.selectedId = null;
    state.selectedIds.clear();
    updateRangeSelection();
    renderGrid();
    updateSelectedBar();
  }
  function cancelRangeSelect() {
    state.rangeSelectAnchor = null;
    state.multiSelect = false;
    state.selectedIds.clear();
    renderGrid();
    updateSelectedBar();
  }
  function updateRangeSelection() {
    if (state.rangeSelectAnchor === null) return;
    const a = Math.min(state.rangeSelectAnchor, state.cursor);
    const b = Math.max(state.rangeSelectAnchor, state.cursor);
    state.selectedIds.clear();
    state.notes.forEach(n => {
      if (n.channelId !== state.activeChannelId) return;
      if (n.step >= a && n.step <= b) state.selectedIds.add(n.id);
    });
  }

  // ---------- Grid render ----------
  function renderGrid() {
    gridEl.innerHTML = "";
    const h = gridEl.clientHeight || 580;
    const rowH = h / state.steps;

    const cursorInt = Math.round(state.cursor);
    for (let i = 0; i < state.steps; i++) {
      const row = document.createElement("div");
      row.className = "row" + (i % 4 === 0 ? " beat" : "") + (i === cursorInt ? " cursor" : "");
      row.style.top = (i * rowH) + "px";
      row.style.height = rowH + "px";
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1).padStart(2, "0");
      row.appendChild(num);
      gridEl.appendChild(row);
    }

    // Cursor line — sits at the TOP of the cursor's row so a new note placed at
    // step=cursor renders right below the line (the note starts where the cursor is).
    const cursorLine = document.createElement("div");
    cursorLine.className = "cursor-line" + (state.cursor !== Math.round(state.cursor) ? " fractional" : "");
    cursorLine.style.top = (state.cursor * rowH) + "px";
    gridEl.appendChild(cursorLine);

    // Independent playhead during playback — lets the user keep editing at the
    // cursor while the sequence runs.
    if (state.playing && state.playhead !== null) {
      const ph = document.createElement("div");
      ph.className = "playhead-line";
      ph.style.top = (state.playhead * rowH) + "px";
      gridEl.appendChild(ph);
    }

    // Only unmuted channels claim grid columns; muted channels keep their (dimmed)
    // header but drop their column entirely so the remaining columns get more room.
    const isSel = (id) => state.multiSelect ? state.selectedIds.has(id) : (id === state.selectedId);
    const gw = gridEl.clientWidth || 360;
    const colLeft = 38;       // matches existing note left-offset
    const colRight = 14;      // matches existing note right-offset
    const visibleChannels = state.channels.filter(c => !c.muted);
    const N = visibleChannels.length || 1;
    const colW = Math.max(20, (gw - colLeft - colRight) / N);

    // Faint vertical dividers between channel columns
    for (let i = 1; i < N; i++) {
      const div = document.createElement("div");
      div.className = "col-divider";
      div.style.left = (colLeft + i * colW) + "px";
      gridEl.appendChild(div);
    }

    // ⋯ button next to the cursor line — opens the per-cursor mini menu.
    // Stays available during playback now that the cursor is independent of
    // the playhead, so editing can continue while the sequence runs.
    {
      const cursorBtn = document.createElement("button");
      cursorBtn.type = "button";
      cursorBtn.className = "cursor-action" + (state.chordMode ? " chord-mode" : "");
      cursorBtn.textContent = state.chordMode ? "♪" : "⋯";
      cursorBtn.title = state.chordMode ? "Chord mode (tap keys to toggle pitches)" : "Cursor actions";
      // Centre the button on the cursor line, but clamp inside the grid so it stays visible
      // when the cursor is at the very top or very bottom.
      cursorBtn.style.top = Math.max(0, Math.min(state.cursor * rowH - 11, h - 22)) + "px";
      cursorBtn.addEventListener("click", openCursorMenu);
      gridEl.appendChild(cursorBtn);
    }

    // Ghost note in the input channel column — previews where a key-press will land.
    const inputIdx = visibleChannels.findIndex(c => c.id === state.activeChannelId);
    if (inputIdx >= 0) {
      const inputCh = visibleChannels[inputIdx];
      const ghostStep = effectivePlacementStep();
      const ghostSize = Math.min(state.defaultSize, state.steps - ghostStep);
      if (ghostSize > 0 && state.rangeSelectAnchor === null && !state.chordMode) {
        const ghost = document.createElement("div");
        ghost.className = "cursor-ghost";
        ghost.style.left  = (colLeft + inputIdx * colW + 2) + "px";
        ghost.style.width = (colW - 4) + "px";
        ghost.style.top    = (ghostStep * rowH + 3) + "px";
        ghost.style.height = Math.max(6, ghostSize * rowH - 6) + "px";
        ghost.style.setProperty("--ch-color", inputCh.color);
        ghost.style.setProperty("--ch-edge", inputCh.edge);
        gridEl.appendChild(ghost);
      }
      // Range selection box in the input channel column.
      if (state.rangeSelectAnchor !== null) {
        const a = Math.min(state.rangeSelectAnchor, state.cursor);
        const b = Math.max(state.rangeSelectAnchor, state.cursor);
        const box = document.createElement("div");
        box.className = "range-box";
        box.style.left   = (colLeft + inputIdx * colW + 2) + "px";
        box.style.width  = (colW - 4) + "px";
        box.style.top    = (a * rowH) + "px";
        box.style.height = Math.max(2, (b - a) * rowH) + "px";
        gridEl.appendChild(box);
      }
    }

    // Group notes that share step+channel into a single chord block.
    const groups = new Map();
    state.notes.forEach(n => {
      if (n.step >= state.steps) return;
      const k = n.step.toFixed(4) + ":" + n.channelId;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(n);
    });

    groups.forEach((notes) => {
      const first = notes[0];
      const colIdx = visibleChannels.findIndex(c => c.id === first.channelId);
      if (colIdx < 0) return; // channel muted — skip rendering its notes
      const ch = visibleChannels[colIdx];
      const isChord = notes.length > 1;
      const el = document.createElement("div");
      let cls = "note";
      if (notes.some(n => isSel(n.id))) cls += " selected";
      if (isChord) cls += " chord";
      el.className = cls;
      el.dataset.id = first.id;

      const label = document.createElement("span");
      label.className = "note-label" + (isChord ? " chord-label" : "");
      if (isChord) {
        // Sort by pitch height (highest first reads naturally) and join with a dot.
        const sorted = notes.slice().sort((a, b) => PITCH_INDEX[a.pitch] - PITCH_INDEX[b.pitch]);
        label.textContent = sorted.slice(0, 3).map(n => n.pitch).join("·")
          + (sorted.length > 3 ? "  +" + (sorted.length - 3) : "");
      } else {
        label.textContent = first.pitch;
      }
      if (first.step < 0.5) label.classList.add("inside");
      // Will-overwrite flag — only meaningful for single notes in normal mode.
      if (!isChord && !state.chordMode &&
          first.channelId === state.activeChannelId &&
          Math.abs(first.step - effectivePlacementStep()) < 1e-6) {
        label.classList.add("will-overwrite");
      }
      el.appendChild(label);

      el.style.left  = (colLeft + colIdx * colW + 2) + "px";
      el.style.width = (colW - 4) + "px";
      el.style.right = "auto";
      el.style.top = (first.step * rowH + 3) + "px";
      const groupSize = Math.max(...notes.map(n => n.size));
      const visibleSize = Math.min(groupSize, state.steps - first.step);
      el.style.height = Math.max(6, visibleSize * rowH - 6) + "px";
      el.style.setProperty("--ch-color", ch.color);
      el.style.setProperty("--ch-edge", ch.edge);

      if (isChord) attachChordGesture(el, notes);
      else attachNoteGesture(el, first.id);
      gridEl.appendChild(el);
    });

    // Keep the keyboard's pitch highlights in sync with wherever the cursor is now.
    refreshKeyHighlights();
    updateFloatingDelete();
  }

  // Tapping a chord block (or any note on a poly channel) opens chord mode at
  // that step so the user can directly add or remove pitches. Long-press still
  // enters multi-select so the chord can be copied / deleted as a group.
  function attachChordGesture(el, notes) {
    let suppress = false;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (suppressNextClick) { suppressNextClick = false; return; }
      if (suppress) { suppress = false; return; }
      enterChordModeAtNote(notes[0]);
    });
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();
      const sx = e.clientX, sy = e.clientY;
      el.classList.add("charging");
      let timer = setTimeout(() => {
        timer = null;
        el.classList.remove("charging");
        el.classList.add("charge-complete");
        setTimeout(() => el.classList.remove("charge-complete"), 360);
        suppress = true;
        suppressNextClick = true;
        // Long-press: select every note in the chord block (multi-select).
        if (state.chordMode) exitChordMode();
        state.multiSelect = true;
        state.selectedId = null;
        state.selectedIds = new Set(notes.map(n => n.id));
        state.cursor = notes[0].step;
        positionKnobFromCursor();
        renderGrid();
        updateSelectedBar();
      }, LONG_PRESS_MS);
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; el.classList.remove("charging"); } };
      const onMove = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cancel(); };
      const onUp = () => {
        cancel();
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
  }

  // Open chord mode anchored at this note's step, with the existing notes (one
  // or many) as the seed. Cursor + scroller jump to the step. If the note is on
  // a different channel, switch input to that channel first.
  function enterChordModeAtNote(n) {
    if (n.channelId !== state.activeChannelId) setActiveChannel(n.channelId);
    state.cursor = n.step;
    positionKnobFromCursor();
    state.chordMode = true;
    state.chordStep = n.step;
    state.selectedId = null;
    if (state.multiSelect) { state.multiSelect = false; state.selectedIds.clear(); }
    // Preview every pitch at this chord step so the user hears what's there.
    state.notes
      .filter(x => x.channelId === state.activeChannelId && Math.abs(x.step - state.chordStep) < 1e-6)
      .forEach(x => { previewNote(x); flashKey(x.pitch); });
    renderGrid();
    refreshKeyHighlights();
    updateSelectedBar();
  }

  const LONG_PRESS_MS = 450;
  let suppressNextClick = false;

  function attachNoteGesture(el, noteId) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (suppressNextClick) { suppressNextClick = false; return; }
      const n = state.notes.find(x => x.id === noteId);
      const ch = n && state.channels.find(c => c.id === n.channelId);
      // Tapping a note on a poly channel opens chord mode at that step so the
      // user can immediately start growing/shrinking the chord.
      if (n && ch && isPolyPreset(ch.presetName)) {
        enterChordModeAtNote(n);
      } else {
        selectNote(noteId);
      }
    });
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();
      const sx = e.clientX, sy = e.clientY;
      el.classList.add("charging");
      let timer = setTimeout(() => {
        timer = null;
        el.classList.remove("charging");
        el.classList.add("charge-complete");
        setTimeout(() => el.classList.remove("charge-complete"), 360);
        suppressNextClick = true;
        enterMultiSelectWith(noteId);
      }, LONG_PRESS_MS);
      const cancel = () => {
        if (timer) { clearTimeout(timer); timer = null; el.classList.remove("charging"); }
      };
      const onMove = (ev) => {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cancel();
      };
      const onUp = () => {
        cancel();
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
  }

  function enterMultiSelectWith(noteId) {
    if (state.multiSelect && state.selectedIds.has(noteId)) {
      // Long-press on an already-selected note removes it from the set.
      state.selectedIds.delete(noteId);
      renderGrid();
      updateSelectedBar();
      return;
    }
    if (!state.multiSelect) {
      state.multiSelect = true;
      state.selectedIds.clear();
      state.selectedId = null;
    }
    state.selectedIds.add(noteId);
    const n = state.notes.find(x => x.id === noteId);
    if (n) { previewNote(n); flashKey(n.pitch); }
    renderGrid();
    updateSelectedBar();
  }

  // ---------- Interactions ----------
  // Where a piano-tap would actually land: the cursor's step, shifted up if a
  // full default-size note wouldn't otherwise fit before the end of the grid.
  function effectivePlacementStep() {
    const maxStart = state.steps - state.defaultSize;
    return Math.max(0, Math.min(state.cursor, maxStart));
  }

  function onKeyPress(pitch, el) {
    if (el) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 120); }
    Tone.start();
    const ch = state.activeChannelId;
    const s = getSynth(ch);
    if (s) triggerSynth(s, pitch, "8n");

    // Snapshot before any state mutation so this key-press is undoable.
    pushUndo();

    // Chord mode: each tap toggles a pitch at the chord's step (add/remove).
    if (state.chordMode) {
      const step = state.chordStep;
      const existing = state.notes.find(n => n.channelId === ch
        && Math.abs(n.step - step) < 1e-6 && n.pitch === pitch);
      if (existing) {
        state.notes = state.notes.filter(n => n !== existing);
        // If no notes remain at this step+channel, exit chord mode automatically.
        const stillHas = state.notes.some(n => n.channelId === ch && Math.abs(n.step - step) < 1e-6);
        if (!stillHas) exitChordMode();
      } else {
        state.notes.push({ id: state.nextId++, step, size: state.defaultSize, pitch, channelId: ch });
      }
      renderGrid();
      refreshKeyHighlights();
      return;
    }

    // Normal mode: a single note per step in the input channel; tap overwrites pitch.
    const targetStep = effectivePlacementStep();
    const existing = state.notes.find(n => n.channelId === ch && Math.abs(n.step - targetStep) < 1e-6 && n.step < state.steps);
    if (existing) {
      existing.pitch = pitch;
      state.selectedId = existing.id;
    } else {
      const note = { id: state.nextId++, step: targetStep, size: state.defaultSize, pitch, channelId: ch };
      state.notes.push(note);
      state.selectedId = note.id;
    }
    renderGrid();
    updateSelectedBar();
  }

  const CHORD_LONG_PRESS_MS = 600;
  function enterChordMode(initialPitch) {
    pushUndo();
    state.chordMode = true;
    state.chordStep = effectivePlacementStep();
    const ch = state.activeChannelId;
    // Seed the chord with the initial pitch (unless it's already there).
    const already = state.notes.find(n => n.channelId === ch
      && Math.abs(n.step - state.chordStep) < 1e-6 && n.pitch === initialPitch);
    if (!already) {
      state.notes.push({
        id: state.nextId++, step: state.chordStep, size: state.defaultSize,
        pitch: initialPitch, channelId: ch
      });
    }
    state.selectedId = null;
    if (state.multiSelect) { state.multiSelect = false; state.selectedIds.clear(); }
    renderGrid();
    refreshKeyHighlights();
    updateSelectedBar();
  }
  function exitChordMode() {
    if (!state.chordMode) return;
    state.chordMode = false;
    state.chordStep = null;
    refreshKeyHighlights();
    renderGrid();
    updateSelectedBar();
  }

  // If the cursor has landed on a step in the input channel that already holds
  // a chord (≥ 2 notes), arm chord mode automatically so the user can edit it
  // by tapping piano keys.
  function autoEnterChordIfOnChord() {
    if (state.chordMode) return;
    const channel = state.channels.find(c => c.id === state.activeChannelId);
    if (!channel || !isPolyPreset(channel.presetName)) return;
    const step = effectivePlacementStep();
    const here = state.notes.filter(n =>
      n.channelId === channel.id && Math.abs(n.step - step) < 1e-6);
    if (here.length >= 2) {
      state.chordMode = true;
      state.chordStep = step;
    }
  }

  function flashKey(pitch) {
    const keyEl = keysEl.querySelector('.key[data-pitch="' + pitch + '"]');
    if (keyEl) { keyEl.classList.add("flash"); setTimeout(() => keyEl.classList.remove("flash"), 120); }
  }

  function selectNote(id) {
    if (!state.multiSelect) {
      const n0 = state.notes.find(x => x.id === id);
      if (n0 && n0.channelId !== state.activeChannelId) {
        // Tapping a note in another channel makes that channel the input channel.
        setActiveChannel(n0.channelId);
      }
    }
    if (state.multiSelect) {
      if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
      } else {
        state.selectedIds.add(id);
        const n = state.notes.find(x => x.id === id);
        if (n) { previewNote(n); flashKey(n.pitch); }
      }
      renderGrid();
      updateSelectedBar();
      return;
    }
    state.selectedId = id;
    const n = state.notes.find(x => x.id === id);
    if (n) {
      state.cursor = n.step;
      positionKnobFromCursor();
      previewNote(n);
      flashKey(n.pitch);
    }
    renderGrid();
    updateSelectedBar();
  }

  function enterMultiSelect() {
    state.multiSelect = true;
    state.selectedIds.clear();
    if (state.selectedId !== null) state.selectedIds.add(state.selectedId);
    state.selectedId = null;
    renderGrid();
    updateSelectedBar();
  }
  function exitMultiSelect() {
    state.multiSelect = false;
    state.selectedIds.clear();
    state.selectedId = null;
    state.rangeSelectAnchor = null;
    renderGrid();
    updateSelectedBar();
  }
  function copySelection() {
    const notes = selectedNotes();
    if (notes.length === 0) return;
    const minStep = Math.min(...notes.map(n => n.step));
    state.clipboard = notes.map(n => ({
      relStep: n.step - minStep,
      pitch: n.pitch,
      size: n.size,
      volume: n.volume,
      attack: n.attack, decay: n.decay, sustain: n.sustain, release: n.release,
    }));
    // Keep selection; just refresh the Paste affordance.
    updateSelectedBar();
    renderGrid();
  }
  function deleteSelection() {
    pushUndo();
    state.notes = state.notes.filter(n => !state.selectedIds.has(n.id));
    exitMultiSelect();
  }
  // "The cursor is inside this note" = note.step ≤ cursor < note.step + size.
  function notesAtCursor() {
    const ch = state.activeChannelId;
    const cur = state.cursor;
    return state.notes.filter(n =>
      n.channelId === ch
      && n.step <= cur + 1e-6
      && cur < n.step + n.size - 1e-6
    );
  }
  function deleteNotesAtCursor() {
    const victims = notesAtCursor();
    if (victims.length === 0) return;
    pushUndo();
    const ids = new Set(victims.map(n => n.id));
    state.notes = state.notes.filter(n => !ids.has(n.id));
    state.selectedId = null;
    if (state.multiSelect) { state.multiSelect = false; state.selectedIds.clear(); }
    if (state.chordMode) exitChordMode();
    renderGrid();
    updateSelectedBar();
  }
  function updateFloatingDelete() {
    if (!floatingDelete) return;
    floatingDelete.disabled = notesAtCursor().length === 0;
  }
  floatingDelete.addEventListener("click", deleteNotesAtCursor);
  function pasteAtCursor() {
    if (!state.clipboard || state.clipboard.length === 0) return;
    pushUndo();
    const channel = state.channels.find(c => c.id === state.activeChannelId);

    // If the clipboard contains a chord (multiple notes sharing a relStep), the
    // target channel must be polyphonic — a MonoSynth can't sustain more than
    // one pitch at a time so stacking would just silently drop voices.
    const stepCounts = new Map();
    state.clipboard.forEach(c => {
      const k = c.relStep.toFixed(4);
      stepCounts.set(k, (stepCounts.get(k) || 0) + 1);
    });
    const clipboardHasChord = [...stepCounts.values()].some(n => n > 1);
    if (clipboardHasChord && !isPolyPreset(channel.presetName)) {
      showToast("Can't paste a chord on a mono instrument — switch to Pad or Keys.");
      return;
    }

    Tone.start();
    const anchor = state.cursor;
    const ch = state.activeChannelId;
    const added = [];
    state.clipboard.forEach(c => {
      const targetStep = anchor + c.relStep;
      if (targetStep >= state.steps) return;
      added.push({
        id: state.nextId++,
        step: targetStep,
        pitch: c.pitch,
        size: c.size,
        channelId: ch,
        volume:  c.volume,
        attack:  c.attack,  decay: c.decay,
        sustain: c.sustain, release: c.release,
      });
    });
    // For mono channels (no chord risk), replace any existing note at each target
    // step before pasting. For poly channels we keep existing chord notes intact
    // unless the same pitch is being pasted at the same step.
    if (isPolyPreset(channel.presetName)) {
      const incoming = new Set(added.map(n => n.step.toFixed(4) + ":" + n.pitch));
      state.notes = state.notes.filter(n =>
        n.channelId !== ch || !incoming.has(n.step.toFixed(4) + ":" + n.pitch));
    } else {
      const incomingSteps = new Set(added.map(n => n.step.toFixed(4)));
      state.notes = state.notes.filter(n =>
        n.channelId !== ch || !incomingSteps.has(n.step.toFixed(4)));
    }
    state.notes.push(...added);
    renderGrid();
    updateSelectedBar();
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg) {
    const existing = root.querySelector("#"+"toast");
    if (existing) existing.remove();
    const t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    t.dataset.seqPopover = "1";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 220);
    }, 2800);
  }

  function updateSelectedBar() {
    // Auto-exit multi-select once it has no notes (range-select stays open
    // even with an empty range so the user can keep extending it).
    if (state.multiSelect && state.selectedIds.size === 0 && state.rangeSelectAnchor === null) {
      state.multiSelect = false;
    }

    moveBtn.classList.add("hidden");
    copyBtn.classList.add("hidden");
    doneBtn.classList.add("hidden");
    deleteBtn.classList.add("hidden");
    multiDeleteBtn.classList.add("hidden");

    const hasSingle = !state.multiSelect && state.selectedId !== null
      && state.notes.some(n => n.id === state.selectedId);
    const hasMulti = state.multiSelect;

    if (hasSingle || hasMulti) {
      copyBtn.classList.remove("hidden");
      doneBtn.classList.remove("hidden");
      if (hasMulti) multiDeleteBtn.classList.remove("hidden");
      else deleteBtn.classList.remove("hidden");
      // Move button — shown whenever the cursor is offset from the selection's
      // anchor (= earliest selected step). Works for single + multi selections.
      const sel = selectedNotes();
      if (sel.length > 0) {
        const anchor = Math.min(...sel.map(n => n.step));
        const target = Math.min(state.cursor, state.steps - 1);
        if (Math.abs(target - anchor) > 1e-6) {
          moveBtn.classList.remove("hidden");
          moveBtn.textContent = "Move " + formatStep(target);
        }
      }
    }
    // Pills always reflect current state — selection if there is one, else
    // the active channel's defaults.
    syncParamPills();

    if (state.clipboard && state.clipboard.length > 0) {
      pasteBtn.classList.remove("hidden");
      pasteBtn.textContent = "Paste";
    } else {
      pasteBtn.classList.add("hidden");
    }
  }

  // ---------- Channels ----------
  function applyActiveChannelStyle() {
    const ch = activeChannel();
    gridEl.style.setProperty("--ch-color", ch.color);
    gridEl.style.setProperty("--ch-edge", ch.edge);
  }

  function renderChannelStrip() {
    const cont = $("channelHeaders");
    cont.innerHTML = "";
    state.channels.forEach(ch => {
      const btn = document.createElement("button");
      btn.type = "button";
      let cls = "channel-col-header";
      if (ch.id === state.activeChannelId) cls += " input";
      if (ch.muted) cls += " muted";
      btn.className = cls;
      btn.dataset.channelId = String(ch.id);
      btn.style.setProperty("--ch", ch.color);
      btn.textContent = ch.name;
      attachChannelHeaderGesture(btn, ch.id);
      cont.appendChild(btn);
    });
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "channel-col-add";
    addBtn.setAttribute("title", "Channels");
    addBtn.setAttribute("aria-label", "Channel settings");
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    addBtn.addEventListener("click", openChannelsPopup);
    cont.appendChild(addBtn);
  }

  function openChannelsPopup() {
    renderChannelList();
    document.querySelectorAll(".popup").forEach(p => p.classList.toggle("hidden", p.dataset.name !== "channels"));
    $("popupLayer").classList.remove("hidden");
  }
  function openSequencerPopup() {
    document.querySelectorAll(".popup").forEach(p => p.classList.toggle("hidden", p.dataset.name !== "sqc"));
    $("popupLayer").classList.remove("hidden");
  }
  function openInsPopup() {
    syncInsPopup();
    document.querySelectorAll(".popup").forEach(p => p.classList.toggle("hidden", p.dataset.name !== "ins"));
    $("popupLayer").classList.remove("hidden");
  }

  // ---------- Param pills (Design A) ----------
  // Returns the notes currently affected by the pills — works for both single and multi.
  function selectedNotes() {
    if (state.multiSelect) {
      return [...state.selectedIds].map(id => state.notes.find(n => n.id === id)).filter(Boolean);
    }
    if (state.selectedId !== null) {
      const n = state.notes.find(x => x.id === state.selectedId);
      return n ? [n] : [];
    }
    return [];
  }
  // Per-note override → channel default fallback for vol & ADSR.
  function effectiveProp(note, prop) {
    if (note[prop] !== undefined && note[prop] !== null) return note[prop];
    const ch = state.channels.find(c => c.id === note.channelId);
    if (!ch) return 0;
    if (prop === "volume") return ch.volume ?? 0.8;
    return ch.adsr[prop];
  }
  // EQ / FX per-note overrides. Each band / effect parameter can be
  // individually overridden on a note; everything else falls back to the
  // channel default. Returns a fully-populated object ready to hand to
  // applyChannelEQ / applyChannelFX.
  function effectiveEQ(note) {
    const ch = state.channels.find(c => c.id === note.channelId);
    const chEQ = ch ? ch.eq : defaultEQ();
    if (!note.eq) return chEQ;
    return {
      low:  note.eq.low  ?? chEQ.low,
      mid:  note.eq.mid  ?? chEQ.mid,
      high: note.eq.high ?? chEQ.high,
    };
  }
  function effectiveFX(note) {
    const ch = state.channels.find(c => c.id === note.channelId);
    const chFX = ch ? ch.fx : defaultFX();
    if (!note.fx) return chFX;
    const out = {};
    for (const e of ["reverb", "delay", "chorus", "distortion"]) {
      if (!note.fx[e]) { out[e] = chFX[e]; continue; }
      out[e] = { ...chFX[e] };
      for (const k in note.fx[e]) {
        if (note.fx[e][k] !== undefined) out[e][k] = note.fx[e][k];
      }
    }
    return out;
  }
  function effectiveEQVal(note, band) { return effectiveEQ(note)[band]; }
  function effectiveFXVal(note, fx, prop) { return effectiveFX(note)[fx][prop]; }
  function effectiveTone(note) {
    const ch = state.channels.find(c => c.id === note.channelId);
    const chTone = ch ? ch.tone : defaultTone();
    if (!note.tone) return chTone;
    return {
      cutoff:    note.tone.cutoff    ?? chTone.cutoff,
      resonance: note.tone.resonance ?? chTone.resonance,
      filterEnv: note.tone.filterEnv ?? chTone.filterEnv,
      pan:       note.tone.pan       ?? chTone.pan,
      glide:     note.tone.glide     ?? chTone.glide,
    };
  }
  function effectiveToneVal(note, key) { return effectiveTone(note)[key]; }
  // Pretty-printers for the Tone params.
  function fmtHz(v) {
    v = Number(v);
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
    return Math.round(v) + "";
  }
  function fmtPan(v) {
    v = Number(v);
    if (Math.abs(v) < 0.01) return "C";
    const n = Math.round(Math.abs(v) * 100);
    return (v < 0 ? "L" : "R") + n;
  }
  function fmtGlide(v) { return Math.round(Number(v) * 1000) + "ms"; }
  function fmtToneVal(key, v) {
    if (key === "cutoff")    return fmtHz(v);
    if (key === "resonance") return Number(v).toFixed(1);
    if (key === "filterEnv") return Number(v).toFixed(1);
    if (key === "pan")       return fmtPan(v);
    if (key === "glide")     return fmtGlide(v);
    return String(v);
  }
  function formatAdsr(v) { return Number(v).toFixed(2).replace(/^0\./, "."); }
  function formatVol(v)  { return Math.round(Number(v) * 100) + "%"; }
  function syncParamPills() {
    const sel = selectedNotes();
    const ch = activeChannel();
    // With a selection: show selected notes' values (or "mixed" if they differ).
    // Without a selection: fall back to the active channel's defaults so the
    // Voice stack always has live values to display.
    const setPill = (el, prop, fmt) => {
      if (sel.length === 0) {
        const fallback = prop === "volume" ? (ch.volume ?? 0.8) : ch.adsr[prop];
        el.textContent = fmt(fallback);
        return;
      }
      const vals = new Set(sel.map(n => effectiveProp(n, prop).toFixed(4)));
      el.textContent = vals.size === 1 ? fmt(effectiveProp(sel[0], prop)) : "mixed";
    };
    if (sel.length > 0) {
      const sizes = new Set(sel.map(n => n.size));
      lenVal.textContent = sizes.size === 1 ? (formatSize(sel[0].size) + "×") : "mixed";
    } else {
      lenVal.textContent = formatSize(state.defaultSize) + "×";
    }
    setPill(volVal, "volume",  formatVol);
    setPill(aVal,   "attack",  formatAdsr);
    setPill(dVal,   "decay",   formatAdsr);
    setPill(sVal,   "sustain", formatAdsr);
    setPill(rVal,   "release", formatAdsr);
    syncEqFxPills();
  }
  // Mirror EQ + FX state onto the bottom-bar pills. With a selection we
  // show the selected note's effective values ("mixed" if multi-select
  // notes disagree); without selection we fall back to channel defaults.
  function syncEqFxPills() {
    const sel = selectedNotes();
    const ch = activeChannel();
    ensureChannelDefaults(ch);
    const fmtDbLocal = (v) => (v > 0 ? "+" : "") + v.toFixed(1).replace(/\.0$/, "");
    const fmtPctLocal = (v) => Math.round(v * 100) + "%";
    const eqVal = (band) => {
      if (sel.length === 0) return fmtDbLocal(ch.eq[band]);
      const vals = new Set(sel.map(n => effectiveEQVal(n, band).toFixed(4)));
      return vals.size === 1 ? fmtDbLocal(effectiveEQVal(sel[0], band)) : "mixed";
    };
    const fxVal = (key) => {
      if (sel.length === 0) return fmtPctLocal(ch.fx[key].wet);
      const vals = new Set(sel.map(n => effectiveFXVal(n, key, "wet").toFixed(4)));
      return vals.size === 1 ? fmtPctLocal(effectiveFXVal(sel[0], key, "wet")) : "mixed";
    };
    eqLowPill.textContent  = eqVal("low");
    eqMidPill.textContent  = eqVal("mid");
    eqHighPill.textContent = eqVal("high");
    reverbPill.textContent = fxVal("reverb");
    delayPill.textContent  = fxVal("delay");
    chorusPill.textContent = fxVal("chorus");
    distPill.textContent   = fxVal("distortion");
    syncTonePills();
  }
  function syncTonePills() {
    const sel = selectedNotes();
    const ch = activeChannel();
    ensureChannelDefaults(ch);
    const tVal = (key) => {
      if (sel.length === 0) return fmtToneVal(key, ch.tone[key]);
      const vals = new Set(sel.map(n => effectiveToneVal(n, key).toFixed(4)));
      return vals.size === 1 ? fmtToneVal(key, effectiveToneVal(sel[0], key)) : "mixed";
    };
    cutoffPill.textContent = tVal("cutoff");
    resPill.textContent    = tVal("resonance");
    envPill.textContent    = tVal("filterEnv");
    panPill.textContent    = tVal("pan");
    glidePill.textContent  = tVal("glide");
  }

  function openParamPopover(pillEl, paramName) {
    closeParamPopover();
    let label, min, max, step, value, fmt, onChange;
    const sel = selectedNotes();
    // EQ / FX pills control channel-level state; open a popover with the
    // primary slider (gain for EQ, wet for FX). Use the popup tab for the
    // full multi-knob editor.
    if (paramName.startsWith("tone-")) {
      const ch = activeChannel();
      ensureChannelDefaults(ch);
      // Map pill suffix → tone key + slider config. Same per-note-override
      // pattern as EQ/FX: with a selection, write n.tone[key]; without one,
      // write ch.tone[key] and update the live audio nodes.
      const spec = {
        "tone-cutoff": { key: "cutoff",    label: "Tone · Cutoff",     min: 80,  max: 12000, step: 10,
                         fmt: (v) => fmtHz(+v) + " Hz" },
        "tone-res":    { key: "resonance", label: "Tone · Resonance",  min: 0.1, max: 20,    step: 0.1,
                         fmt: (v) => Number(v).toFixed(1) },
        "tone-env":    { key: "filterEnv", label: "Tone · Filter Env", min: 0,   max: 7,     step: 0.1,
                         fmt: (v) => Number(v).toFixed(1) + " oct" },
        "tone-pan":    { key: "pan",       label: "Tone · Pan",        min: -1,  max: 1,     step: 0.02,
                         fmt: (v) => fmtPan(+v) },
        "tone-glide":  { key: "glide",     label: "Tone · Glide",      min: 0,   max: 0.3,   step: 0.005,
                         fmt: (v) => fmtGlide(+v) },
      }[paramName];
      label = spec.label; min = spec.min; max = spec.max; step = spec.step; fmt = spec.fmt;
      value = sel.length ? effectiveToneVal(sel[0], spec.key) : ch.tone[spec.key];
      onChange = (v) => {
        beginSliderSession(pillEl);
        const num = parseFloat(v);
        const targets = selectedNotes();
        if (targets.length > 0) {
          targets.forEach(n => {
            if (!n.tone) n.tone = {};
            n.tone[spec.key] = num;
          });
        } else {
          ch.tone[spec.key] = num;
          applyChannelTone(channelSynths[ch.id], channelChains[ch.id], ch.tone);
          // Mirror into the Instrument popup's Tone tab so its sliders stay
          // in sync if the user opens it after dragging the pill.
          const popMap = {
            cutoff:    [cutoffEl,    cutoffV,    (v) => fmtHz(v) + " Hz"],
            resonance: [resEl,       resV,       (v) => v.toFixed(1)],
            filterEnv: [filterEnvEl, filterEnvV, (v) => v.toFixed(1) + " oct"],
            pan:       [panEl,       panV,       (v) => fmtPan(v)],
            glide:     [glideEl,     glideV,     (v) => fmtGlide(v)],
          }[spec.key];
          if (popMap) {
            popMap[0].value = ch.tone[spec.key];
            popMap[1].textContent = popMap[2](ch.tone[spec.key]);
          }
        }
        syncTonePills();
      };
    } else if (paramName.startsWith("eq-") || paramName.startsWith("fx-")) {
      const ch = activeChannel();
      ensureChannelDefaults(ch);
      // With a selection, EQ + FX changes write per-note overrides (just
      // like Vol/ADSR pills). Without a selection they update the channel
      // default. The seed value mirrors that: selected note's effective
      // value, else channel default.
      if (paramName === "eq-low" || paramName === "eq-mid" || paramName === "eq-high") {
        const band = paramName.slice(3);
        label = "EQ · " + band[0].toUpperCase() + band.slice(1);
        min = -18; max = 18; step = 0.5;
        value = sel.length ? effectiveEQVal(sel[0], band) : ch.eq[band];
        fmt = (v) => fmtDb(+v) + " dB";
        onChange = (v) => {
          beginSliderSession(pillEl);
          const num = parseFloat(v);
          const targets = selectedNotes();
          if (targets.length > 0) {
            targets.forEach(n => {
              if (!n.eq) n.eq = {};
              n.eq[band] = num;
            });
          } else {
            ch.eq[band] = num;
            applyChannelEQ(channelChains[ch.id], ch.eq);
            // Mirror into popup sliders.
            if (band === "low")  { eqLowEl.value  = ch.eq.low;  eqLowV.textContent  = fmtDb(ch.eq.low); }
            if (band === "mid")  { eqMidEl.value  = ch.eq.mid;  eqMidV.textContent  = fmtDb(ch.eq.mid); }
            if (band === "high") { eqHighEl.value = ch.eq.high; eqHighV.textContent = fmtDb(ch.eq.high); }
          }
          syncEqFxPills();
        };
      } else {
        // fx-reverb / fx-delay / fx-chorus / fx-distortion → wet
        const key = paramName.slice(3);
        const niceName = { reverb: "Reverb", delay: "Delay", chorus: "Chorus", distortion: "Distortion" }[key];
        label = niceName + " · Wet";
        min = 0; max = 1; step = 0.01;
        value = sel.length ? effectiveFXVal(sel[0], key, "wet") : ch.fx[key].wet;
        fmt = (v) => fmtPct(+v);
        onChange = (v) => {
          beginSliderSession(pillEl);
          const num = parseFloat(v);
          const targets = selectedNotes();
          if (targets.length > 0) {
            targets.forEach(n => {
              if (!n.fx) n.fx = {};
              if (!n.fx[key]) n.fx[key] = {};
              n.fx[key].wet = num;
            });
          } else {
            ch.fx[key].wet = num;
            applyChannelFX(channelChains[ch.id], ch.fx);
            const popEl = { reverb: reverbWetEl, delay: delayWetEl, chorus: chorusWetEl, distortion: distWetEl }[key];
            const popV  = { reverb: reverbWetV,  delay: delayWetV,  chorus: chorusWetV,  distortion: distWetV  }[key];
            if (popEl) popEl.value = ch.fx[key].wet;
            if (popV)  popV.textContent = fmtPct(ch.fx[key].wet);
          }
          syncEqFxPills();
        };
      }
    } else if (paramName === "len") {
      label = "Length";
      min = 0; max = 9; step = 1;
      value = sel.length ? sizeIndex(sel[0].size) : 2;
      fmt = (v) => formatSize(SIZE_STEPS[v]) + "×";
      onChange = (v) => {
        const size = SIZE_STEPS[v];
        selectedNotes().forEach(n => {
          n.size = Math.min(size, state.steps - n.step);
        });
        lenVal.textContent = fmt(v);
        renderGrid();
      };
    } else if (paramName === "vol") {
      label = "Volume";
      min = 0; max = 1; step = 0.01;
      value = sel.length ? effectiveProp(sel[0], "volume") : 0.8;
      fmt = formatVol;
      onChange = (v) => {
        selectedNotes().forEach(n => { n.volume = parseFloat(v); });
        volVal.textContent = fmt(v);
      };
    } else {
      // ADSR — per-note override (falls back to channel default).
      const map = { a: ["attack",  0, 2, 0.01, aVal],
                    d: ["decay",   0, 2, 0.01, dVal],
                    s: ["sustain", 0, 1, 0.01, sVal],
                    r: ["release", 0, 4, 0.01, rVal] };
      const [key, mn, mx, st, valEl] = map[paramName];
      label = "Envelope · " + key[0].toUpperCase() + key.slice(1);
      min = mn; max = mx; step = st;
      value = sel.length ? effectiveProp(sel[0], key) : 0;
      fmt = formatAdsr;
      onChange = (v) => {
        const num = parseFloat(v);
        selectedNotes().forEach(n => { n[key] = num; });
        valEl.textContent = fmt(num);
      };
    }

    const pop = document.createElement("div");
    pop.className = "param-popover";
    pop.id = "paramPopover";
    pop.dataset.seqPopover = "1";
    pop.innerHTML =
      '<div class="pop-head"><span class="lab">' + label + '</span>' +
      '<span class="v" id="popVal">' + fmt(value) + '</span></div>' +
      '<input type="range" id="popRange" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">';
    document.body.appendChild(pop);

    // Position above the pill so it's reachable with the thumb.
    const r = pillEl.getBoundingClientRect();
    const popH = pop.offsetHeight || 96;
    let top = r.top - popH - 10;
    if (top < 16) top = r.bottom + 10;
    let left = r.left;
    if (left + pop.offsetWidth + 12 > window.innerWidth) left = window.innerWidth - pop.offsetWidth - 12;
    pop.style.top = top + "px";
    pop.style.left = left + "px";

    const range = pop.querySelector("#popRange");
    const popVal = pop.querySelector("#popVal");
    range.addEventListener("input", () => {
      popVal.textContent = fmt(range.value);
      onChange(range.value);
      // Audible preview after the slider settles. If exactly one note is
      // selected, play *that* note's pitch — it routes through the active
      // channel's effect chain, so EQ / FX / Voice tweaks all become
      // audible against the actual edit subject. Otherwise fall back to
      // the channel C4 ping.
      beginSliderSession(range);
      const selNow = selectedNotes();
      if (selNow.length === 1) {
        if (range._previewTimer) clearTimeout(range._previewTimer);
        range._previewTimer = setTimeout(() => {
          range._previewTimer = 0;
          previewNote(selNow[0]);
        }, 150);
      } else {
        scheduleAdsrPreview();
      }
    });

    // Wrap in a fullscreen overlay; clicking the overlay (target is the
    // overlay itself, not the popover content) closes the popover. The
    // popover keeps its already-computed absolute top/left from above.
    const overlay = document.createElement("div");
    overlay.className = "seq-menu-overlay";
    overlay.id = "paramPopoverOverlay";
    overlay.dataset.seqPopover = "1";
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) closeParamPopover();
    });
    // Move the popover into the overlay (already appended to document.body
    // above so positioning could be measured). Re-parenting preserves the
    // computed style/position.
    overlay.appendChild(pop);
    document.body.appendChild(overlay);
  }
  function closeParamPopover() {
    const o = root.querySelector("#"+"paramPopoverOverlay");
    if (o) o.remove();
    const p = root.querySelector("#"+"paramPopover");
    if (p) p.remove();
  }

  // Delegate from the stack scroller so all param pills (Voice / EQ / FX)
  // open a popover, regardless of which stack they live in.
  stackScroller.addEventListener("click", (e) => {
    const pill = e.target.closest(".param-pill");
    if (!pill) return;
    openParamPopover(pill, pill.dataset.param);
  });

  function attachChannelHeaderGesture(el, channelId) {
    let suppress = false;
    el.addEventListener("click", () => {
      if (suppress) { suppress = false; return; }
      setActiveChannel(channelId);
    });
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY;
      el.classList.add("charging");
      let timer = setTimeout(() => {
        timer = null;
        el.classList.remove("charging");
        suppress = true;
        if (channelId === state.activeChannelId) {
          // Long-press on the input chip → open the instrument settings.
          el.classList.add("charge-complete");
          setTimeout(() => el.classList.remove("charge-complete"), 360);
          openInsPopup();
        } else {
          toggleChannelMuted(channelId);
          // toggleChannelMuted re-renders the strip; play the burst on the new chip.
          const newChip = $("channelHeaders").querySelector('[data-channel-id="' + channelId + '"]');
          if (newChip) {
            newChip.classList.add("charge-complete");
            setTimeout(() => newChip.classList.remove("charge-complete"), 360);
          }
        }
      }, LONG_PRESS_MS);
      const cancel = () => {
        if (timer) { clearTimeout(timer); timer = null; el.classList.remove("charging"); }
      };
      const onMove = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cancel(); };
      const onUp = () => {
        cancel();
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
  }

  function toggleChannelMuted(id) {
    const ch = state.channels.find(c => c.id === id);
    if (!ch) return;
    // Don't allow muting the input channel — switch input elsewhere first.
    if (ch.id === state.activeChannelId) return;
    pushUndo();
    ch.muted = !ch.muted;
    renderChannelStrip();
    renderGrid();
  }

  function setActiveChannel(id) {
    if (id === state.activeChannelId) return;
    const ch = state.channels.find(c => c.id === id);
    if (ch && ch.muted) ch.muted = false; // tapping a muted chip un-mutes + activates
    state.activeChannelId = id;
    state.selectedId = null;
    if (state.multiSelect) { state.multiSelect = false; state.selectedIds.clear(); }
    state.rangeSelectAnchor = null;
    if (state.chordMode) exitChordMode();
    autoEnterChordIfOnChord();
    applyActiveChannelStyle();
    renderChannelStrip();
    renderGrid();
    updateSelectedBar();
    syncInsPopup();
  }

  function renderChannelList() {
    const list = $("channelList");
    list.innerHTML = "";
    state.channels.forEach((ch, idx) => {
      const card = document.createElement("div");
      card.className = "channel-card";
      card.style.setProperty("--ch", ch.color);

      const header = document.createElement("div");
      header.className = "channel-card-header";
      const nameEl = document.createElement("input");
      nameEl.type = "text"; nameEl.className = "name"; nameEl.value = ch.name; nameEl.maxLength = 16;
      nameEl.addEventListener("input", () => { ch.name = nameEl.value || "Untitled"; renderChannelStrip(); });

      const reorder = document.createElement("div");
      reorder.className = "reorder";
      const upBtn = document.createElement("button");
      upBtn.type = "button"; upBtn.title = "Move up";
      upBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>';
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", () => moveChannel(ch.id, -1));
      const downBtn = document.createElement("button");
      downBtn.type = "button"; downBtn.title = "Move down";
      downBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10l6 6 6-6"/></svg>';
      downBtn.disabled = idx === state.channels.length - 1;
      downBtn.addEventListener("click", () => moveChannel(ch.id, +1));
      reorder.appendChild(upBtn); reorder.appendChild(downBtn);

      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "remove"; rm.textContent = "×";
      rm.disabled = state.channels.length <= 1;
      rm.addEventListener("click", () => removeChannel(ch.id));
      header.appendChild(nameEl); header.appendChild(reorder); header.appendChild(rm);
      card.appendChild(header);

      const swatches = document.createElement("div");
      swatches.className = "swatches";
      CHANNEL_PALETTE.forEach(p => {
        const s = document.createElement("button");
        s.type = "button"; s.className = "swatch" + (p.color === ch.color ? " active" : "");
        s.style.background = p.color;
        s.addEventListener("click", () => {
          ch.color = p.color; ch.edge = p.edge;
          renderChannelList();
          renderChannelStrip();
          if (ch.id === state.activeChannelId) { applyActiveChannelStyle(); renderGrid(); }
        });
        swatches.appendChild(s);
      });
      card.appendChild(swatches);

      list.appendChild(card);
    });
  }

  function moveChannel(id, delta) {
    const i = state.channels.findIndex(c => c.id === id);
    if (i < 0) return;
    const j = i + delta;
    if (j < 0 || j >= state.channels.length) return;
    const [c] = state.channels.splice(i, 1);
    state.channels.splice(j, 0, c);
    renderChannelList();
    renderChannelStrip();
    renderGrid();
  }

  function removeChannel(id) {
    if (state.channels.length <= 1) return;
    pushUndo();
    state.notes = state.notes.filter(n => n.channelId !== id);
    state.channels = state.channels.filter(c => c.id !== id);
    disposeChannelSynth(id);
    if (state.activeChannelId === id) {
      state.activeChannelId = state.channels[0].id;
      state.selectedId = null;
      if (state.multiSelect) { state.multiSelect = false; state.selectedIds.clear(); }
      applyActiveChannelStyle();
      syncInsPopup();
    }
    renderChannelList();
    renderChannelStrip();
    renderGrid();
    updateSelectedBar();
  }

  function addChannel() {
    pushUndo();
    const usedColors = new Set(state.channels.map(c => c.color));
    const palette = CHANNEL_PALETTE.find(p => !usedColors.has(p.color)) || CHANNEL_PALETTE[state.channels.length % CHANNEL_PALETTE.length];
    const presetName = PRESET_ORDER[state.channels.length % PRESET_ORDER.length];
    const p = PRESETS[presetName];
    state.channels.push({
      id: state.nextChannelId++,
      name: "Channel " + (state.channels.length + 1),
      color: palette.color,
      edge: palette.edge,
      presetName,
      muted: false,
      volume: 0.8,
      adsr: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
      eq: defaultEQ(),
      fx: defaultFX(),
      tone: defaultTone(),
    });
    renderChannelList();
    renderChannelStrip();
  }

  $("addChannelBtn").addEventListener("click", addChannel);

  // ---------- Popups ----------
  const popupLayer = $("popupLayer");
  document.querySelectorAll("[data-popup]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.popup;
      if (name === "channels") renderChannelList();
      if (name === "ins") syncInsPopup();
      document.querySelectorAll(".popup").forEach(p => p.classList.toggle("hidden", p.dataset.name !== name));
      popupLayer.classList.remove("hidden");
    });
  });
  document.querySelectorAll(".popup-close").forEach(b => b.addEventListener("click", () => popupLayer.classList.add("hidden")));
  popupLayer.addEventListener("click", (e) => { if (e.target === popupLayer) popupLayer.classList.add("hidden"); });

  // ---------- App integration hooks ----------
  // The React wrapper passes callbacks for navigation and song-level edits
  // through the same `options` bag used for initialState / onChange. These
  // are no-ops in the standalone mockup.
  const backBtn = $("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (options.onBack) options.onBack();
    });
  }
  const songSectionOwner = $("songSectionOwner");
  const songSectionGuest = $("songSectionGuest");
  const songTitleInput = $("songTitleInput");
  const songCreatorName = $("songCreatorName");
  const songCopyBtn = $("songCopyBtn");
  if (options.isOwner === false) {
    songSectionGuest.style.display = "";
    if (songCreatorName && options.creatorDisplay) songCreatorName.textContent = options.creatorDisplay;
  } else {
    // Default to owner mode (matches the standalone mockup where no host
    // app is wiring isOwner=false).
    songSectionOwner.style.display = "";
  }
  if (songTitleInput) {
    songTitleInput.value = options.songTitle || "";
    songTitleInput.addEventListener("blur", () => {
      const v = songTitleInput.value.trim();
      if (!v) { songTitleInput.value = options.songTitle || ""; return; }
      if (v === options.songTitle) return;
      if (options.onRenameTitle) options.onRenameTitle(v);
      options.songTitle = v;
    });
    songTitleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); songTitleInput.blur(); }
    });
  }
  if (songCopyBtn) {
    songCopyBtn.addEventListener("click", () => {
      if (options.onCopy) options.onCopy();
    });
  }

  // Preset segments are re-rendered into #presetGroups whenever the active
  // channel changes, so we delegate the click instead of binding per-seg.
  $("presetGroups").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    const value = btn.dataset.value;
    pushUndo();
    const ch = activeChannel();
    ch.presetName = value;
    const p = PRESETS[value];
    ch.adsr = {
      attack:  p.attack  ?? 0.01,
      decay:   p.decay   ?? 0.2,
      sustain: p.sustain ?? 0.0,
      release: p.release ?? 0.3,
    };
    renderPresetButtons(); // refresh active marker across all category segs
    disposeChannelSynth(ch.id);
    const newSynth = getSynth(ch.id);
    // Mono preset can't sustain chords — bail out of chord mode if it was open.
    if (state.chordMode && !isPolyPreset(value)) exitChordMode();
    syncInsPopup();
    if (newSynth) {
      Tone.start();
      triggerSynth(newSynth, "C4", "8n");
    }
  });
  // Other segmented controls (snap, scale, etc.) keep the simple per-seg binding.
  document.querySelectorAll(".seg").forEach(seg => {
    if (seg.dataset.group === "instrument") return;
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-value]");
      if (!btn) return;
      seg.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
      const group = seg.dataset.group;
      const value = btn.dataset.value;
      if (group === "snap") state.snap = value;
      else if (group === "scaleOn") { state.scaleOn = value === "1"; refreshKeyHighlights(); }
      else if (group === "root") { state.scaleRoot = value; refreshKeyHighlights(); }
      else if (group === "scale") { state.scaleType = value; refreshKeyHighlights(); }
    });
  });

  defaultSizeEl.addEventListener("input", () => {
    state.defaultSize = SIZE_STEPS[parseInt(defaultSizeEl.value, 10)];
    defaultSizeValEl.textContent = formatSize(state.defaultSize);
    renderGrid(); // keep the ghost preview in sync with the new default size
  });
  zoomEl.addEventListener("input", () => {
    state.keyboardZoom = parseInt(zoomEl.value, 10) / 100;
    zoomValEl.textContent = zoomEl.value;
    renderKeys();
  });

  copyBtn.addEventListener("click", copySelection);
  multiDeleteBtn.addEventListener("click", deleteSelection);
  doneBtn.addEventListener("click", exitMultiSelect);
  pasteBtn.addEventListener("click", pasteAtCursor);
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);
  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) = redo.
  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
  });

  deleteBtn.addEventListener("click", () => {
    pushUndo();
    state.notes = state.notes.filter(n => n.id !== state.selectedId);
    state.selectedId = null;
    renderGrid();
    updateSelectedBar();
  });

  moveBtn.addEventListener("click", () => {
    const sel = selectedNotes();
    if (sel.length === 0) return;
    const anchor = Math.min(...sel.map(n => n.step));
    const target = Math.min(state.cursor, state.steps - 1);
    const delta = target - anchor;
    if (Math.abs(delta) < 1e-6) return;
    pushUndo();

    // Skip the move if any selected note would fall off the grid.
    const wouldOverflow = sel.some(n => {
      const ns = n.step + delta;
      return ns < -1e-6 || ns >= state.steps;
    });
    if (wouldOverflow) return;

    const selectedSet = new Set(sel);
    // Drop any non-selected note that would collide with a moved one (same
    // channel + same target step; on poly channels also require the same pitch
    // so other chord-mates at the destination survive).
    state.notes = state.notes.filter(x => {
      if (selectedSet.has(x)) return true;
      return !sel.some(n => {
        if (x.channelId !== n.channelId) return false;
        if (Math.abs(x.step - (n.step + delta)) > 1e-6) return false;
        const ch = state.channels.find(c => c.id === n.channelId);
        return ch && isPolyPreset(ch.presetName) ? x.pitch === n.pitch : true;
      });
    });
    sel.forEach(n => { n.step += delta; });
    // The chord (if it is one) now lives at the cursor's step — re-arm chord
    // mode so the user can keep editing it without an extra tap.
    autoEnterChordIfOnChord();
    renderGrid();
    updateSelectedBar();
  });

  // click empty area: move cursor to that step. Outside multi-select mode it also deselects.
  // (Note clicks call stopPropagation, so this only fires when no note was tapped.)
  gridEl.addEventListener("click", (e) => {
    const r = gridEl.getBoundingClientRect();
    const rowH = r.height / state.steps;
    // Map the click's vertical position to a fractional step, then snap.
    // For step-snap, a tap inside row N should land the cursor on row N
    // (floor) — round-to-nearest would jump the cursor a row down whenever
    // the user taps the lower half of a row. The knob uses snapCursor's
    // round-to-nearest still, which is correct for continuous dragging.
    const raw = (e.clientY - r.top) / rowH;
    if (state.snap === "step") {
      state.cursor = Math.max(0, Math.min(state.steps, Math.floor(raw)));
    } else {
      state.cursor = snapCursor(raw);
    }
    // Tapping inside another channel's column switches the input channel —
    // quick way to redirect input without going up to the header chips.
    // Uses the same column math as renderGrid; clicks in the step-number
    // gutter (left of colLeft) are ignored so they only move the cursor.
    const colLeft = 38, colRight = 14;
    const visibleChannels = state.channels.filter(c => !c.muted);
    const N = visibleChannels.length || 1;
    const colW = Math.max(20, (r.width - colLeft - colRight) / N);
    const x = e.clientX - r.left;
    if (x >= colLeft && x < colLeft + N * colW) {
      const colIdx = Math.min(N - 1, Math.floor((x - colLeft) / colW));
      const ch = visibleChannels[colIdx];
      if (ch && ch.id !== state.activeChannelId) {
        setActiveChannel(ch.id);
        positionKnobFromCursor();
        return; // setActiveChannel re-renders the grid; just sync the knob.
      }
    }
    // Selection persists across cursor moves now so the Move-to-cursor flow
    // works after a grid tap. Use the Reset button to deselect explicitly.
    if (state.chordMode && Math.abs(state.cursor - state.chordStep) > 1e-6) exitChordMode();
    autoEnterChordIfOnChord();
    updateRangeSelection();
    renderGrid();
    positionKnobFromCursor();
    updateSelectedBar();
  });

  // ---------- Length ----------
  lengthEl.addEventListener("input", () => {
    beginSliderSession(lengthEl);
    state.steps = parseInt(lengthEl.value, 10);
    lengthValEl.textContent = state.steps;
    state.cursor = Math.min(state.cursor, state.steps);
    // do NOT remove out-of-range notes — they stay in state and reappear when length grows again
    renderGrid();
    positionKnobFromCursor();
    updateSelectedBar();
  });

  // ---------- Scroller knob ----------
  function positionKnobFromCursor() {
    const r = scrollerEl.getBoundingClientRect();
    const pad = 18;
    const usable = r.height - pad * 2;
    const frac = state.cursor / Math.max(1, state.steps);
    knobEl.style.top = (pad + frac * usable) + "px";
  }
  function snapCursor(raw) {
    const clamped = Math.max(0, Math.min(state.steps, raw));
    if (state.snap === "step") return Math.round(clamped);
    if (state.snap === "half") return Math.round(clamped * 2) / 2;
    return Math.round(clamped * 100) / 100; // "off" — keep some quantization for sanity
  }

  function setCursorFromClientY(clientY) {
    const r = scrollerEl.getBoundingClientRect();
    const pad = 18;
    const usable = r.height - pad * 2;
    const y = Math.max(0, Math.min(usable, clientY - r.top - pad));
    const frac = y / usable;
    const next = snapCursor(frac * state.steps);
    if (Math.abs(next - state.cursor) > 1e-6) {
      state.cursor = next;
      if (state.chordMode) exitChordMode();
      autoEnterChordIfOnChord();
      updateRangeSelection();
      renderGrid();
      updateSelectedBar();
    }
    positionKnobFromCursor();
  }
  // Multi-touch-safe drag. setPointerCapture has a history of bugs on iOS
  // Safari (WebKit #220196) — even after the 15.5 fix, the very first event
  // after capture can drop, and a captured pointer can interfere with the
  // delivery of subsequent unrelated touches on the same page. Apple's own
  // docs and Patrick Lauke's research recommend native TouchEvents for
  // multi-touch sliders: touchmove/touchend always fire on the element
  // that received touchstart, regardless of where the finger drifts, and
  // each concurrent touch has its own identifier so other touches
  // (piano, channels, bottom bar) fire their events independently.
  //
  // Mouse fallback for desktop is kept on window-level handlers — iOS
  // suppresses synthetic mouse events when real touches are in flight, so
  // the two paths don't double-fire.
  let knobTouchId = null;
  knobEl.addEventListener("touchstart", (e) => {
    if (knobTouchId !== null) return;
    knobTouchId = e.changedTouches[0].identifier;
    e.preventDefault();
  }, { passive: false });
  knobEl.addEventListener("touchmove", (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === knobTouchId) {
        setCursorFromClientY(t.clientY);
        e.preventDefault();
        return;
      }
    }
  }, { passive: false });
  const endKnobTouch = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === knobTouchId) {
        knobTouchId = null;
        return;
      }
    }
  };
  knobEl.addEventListener("touchend", endKnobTouch);
  knobEl.addEventListener("touchcancel", endKnobTouch);
  // Mouse fallback (desktop).
  let mouseDragging = false;
  knobEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseDragging = true;
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (mouseDragging) setCursorFromClientY(e.clientY);
  });
  window.addEventListener("mouseup", () => { mouseDragging = false; });
  // Tap on the scroller track (outside the knob) jumps the cursor.
  scrollerEl.addEventListener("click", (e) => {
    if (e.target === knobEl) return;
    setCursorFromClientY(e.clientY);
  });

  // ---------- Transport ----------
  let scheduledId = null;
  let currentPart = null;
  const stepTime = "8n";

  function teardownPlayback() {
    if (currentPart) { try { currentPart.dispose(); } catch (_) {} currentPart = null; }
    if (scheduledId !== null) { Tone.Transport.clear(scheduledId); scheduledId = null; }
    Tone.Transport.cancel(0);
  }

  // Move just the playhead line without rebuilding the rest of the grid.
  // Called from the playback scheduleRepeat tick — keeping DOM churn out of
  // the hot path is what lets the grid stay clickable while playing.
  function updatePlayheadOnly() {
    let ph = gridEl.querySelector(".playhead-line");
    if (state.playhead === null || !state.playing) {
      if (ph) ph.remove();
      return;
    }
    const h = gridEl.clientHeight || 580;
    const rowH = h / state.steps;
    if (!ph) {
      ph = document.createElement("div");
      ph.className = "playhead-line";
      gridEl.appendChild(ph);
    }
    ph.style.top = (state.playhead * rowH) + "px";
  }

  // iOS Safari requires the AudioContext to be `running` before any node
  // produces sound. Tone.start() resumes it but returns a Promise — if we
  // don't await, Transport.start() races the unlock and the first run plays
  // silently. We capture the promise on the first user interaction so every
  // later audio path can sync on it cheaply. Callers (play / previewNote)
  // await this; we deliberately don't attach a document-level capture-phase
  // listener because that interferes with click delivery on iOS Safari.
  let audioUnlockPromise = null;
  function unlockAudio() {
    if (!audioUnlockPromise) audioUnlockPromise = Tone.start();
    return audioUnlockPromise;
  }

  async function play() {
    await unlockAudio();
    if (state.playing) {
      // Fully stop (not just pause) so the transport position resets to 0 and
      // the next play() can re-seek cleanly from the cursor.
      Tone.Transport.stop();
      teardownPlayback();
      state.playing = false;
      state.playhead = null;
      playBtn.textContent = "PLAY";
      playBtn.dataset.state = "stopped";
      renderGrid();
      return;
    }
    // Ensure a clean transport before we schedule the next run.
    Tone.Transport.stop();
    teardownPlayback();

    state.playing = true;
    state.playhead = state.cursor;
    playBtn.textContent = "PAUSE";
    playBtn.dataset.state = "playing";

    const stepSec = Tone.Time(stepTime).toSeconds();
    const totalSec = state.steps * stepSec;

    // Schedule every note at its exact fractional time, looping the whole pattern.
    const mutedChannels = new Set(state.channels.filter(c => c.muted).map(c => c.id));
    const events = state.notes
      .filter(n => n.step < state.steps && !mutedChannels.has(n.channelId))
      .map(n => [n.step * stepSec, n]);

    currentPart = new Tone.Part((time, n) => {
      const dur = Math.min(n.size, state.steps - n.step) * stepSec;
      const s = getSynth(n.channelId);
      if (s) {
        setSynthEnvelope(s, {
          attack:  effectiveProp(n, "attack"),
          decay:   effectiveProp(n, "decay"),
          sustain: effectiveProp(n, "sustain"),
          release: effectiveProp(n, "release"),
        });
        // Per-note EQ + FX overrides routed via the channel's chain. With
        // overlapping notes that have different overrides this can crackle
        // because the chain state is shared — acceptable trade-off for the
        // mockup; production would use per-voice chains.
        const chain = channelChains[n.channelId];
        if (chain) {
          applyChannelEQ(chain, effectiveEQ(n));
          applyChannelFX(chain, effectiveFX(n));
          applyChannelTone(s, chain, effectiveTone(n));
        }
        triggerSynth(s, n.pitch, dur, time, effectiveProp(n, "volume"));
      }
      Tone.Draw.schedule(() => {
        const el = gridEl.querySelector('.note[data-id="' + n.id + '"]');
        if (el) {
          el.classList.add("playing");
          setTimeout(() => el.classList.remove("playing"), dur * 1000);
        }
      }, time);
    }, events);
    currentPart.loop = true;
    currentPart.loopEnd = totalSec;
    currentPart.start(0);

    // Smooth playhead animation — updates the playhead display from the transport
    // position. The user's cursor is left alone so editing can continue. We
    // deliberately do NOT call renderGrid() on every tick: rebuilding the
    // whole grid DOM 16x/sec dropped mousedown/up pairs and made the grid feel
    // unclickable during playback. Instead we move the playhead element only.
    scheduledId = Tone.Transport.scheduleRepeat((time) => {
      Tone.Draw.schedule(() => {
        if (!state.playing) return;
        const pos = Tone.Transport.seconds % totalSec;
        state.playhead = pos / stepSec;
        updatePlayheadOnly();
      }, time);
    }, "32n");

    // Start playback at the cursor's current position.
    Tone.Transport.seconds = state.cursor * stepSec;
    Tone.Transport.start();
  }
  function stop() {
    Tone.Transport.stop();
    teardownPlayback();
    state.playing = false;
    state.playhead = null;
    playBtn.textContent = "PLAY";
    playBtn.dataset.state = "stopped";
    // STOP rewinds the cursor to the top — that's the classic transport
    // behaviour. PAUSE (handled in play()) leaves the cursor alone.
    state.cursor = 0;
    if (state.chordMode) exitChordMode();
    renderGrid();
    positionKnobFromCursor();
    updateSelectedBar();
  }
  playBtn.addEventListener("click", play);
  stopBtn.addEventListener("click", stop);

  // ---------- Init ----------
  function scrollPianoTo(pitch) {
    const el = keysEl.querySelector('.key[data-pitch="' + pitch + '"]');
    const piano = keysEl.parentElement;
    if (!el || !piano) return;
    piano.scrollTop = el.offsetTop - piano.clientHeight / 2 + el.offsetHeight / 2;
  }

  // Display label for each preset key — anything not listed falls back to a
  // Title-Cased version of the key.
  const PRESET_LABELS = {
    bass: "Bass", lead: "Lead", pluck: "Pluck", sub: "Sub", acid: "Acid", reese: "Reese",
    pad: "Pad", keys: "Keys", bell: "Bell", marimba: "Marimba",
    organ: "Organ", strings: "Strings", choir: "Choir",
    kick: "Kick", "808": "808", snare: "Snare", clap: "Clap",
    hat: "Hat", ohat: "Open Hat", tom: "Tom", perc: "Perc", rim: "Rim",
    crash: "Crash", ride: "Ride", riser: "Riser", fx: "FX",
  };
  function renderPresetButtons() {
    const cont = $("presetGroups");
    if (!cont) return;
    cont.innerHTML = "";
    const active = activeChannel().presetName;
    PRESET_CATEGORIES.forEach(cat => {
      const group = document.createElement("div");
      group.className = "preset-group";
      const lab = document.createElement("div");
      lab.className = "preset-group-label";
      lab.textContent = cat.label;
      group.appendChild(lab);
      const seg = document.createElement("div");
      seg.className = "seg seg-presets";
      seg.dataset.group = "instrument";
      cat.presets.forEach(name => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.value = name;
        if (PRESETS[name] && PRESETS[name].poly) btn.dataset.poly = "1";
        if (name === active) btn.classList.add("active");
        btn.textContent = PRESET_LABELS[name] || (name[0].toUpperCase() + name.slice(1));
        seg.appendChild(btn);
      });
      group.appendChild(seg);
      cont.appendChild(group);
    });
  }

  // --- Instrument popup tabs ---
  document.querySelectorAll(".ins-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      document.querySelectorAll(".ins-tab").forEach(x => x.classList.toggle("active", x === tab));
      document.querySelectorAll(".ins-tab-pane").forEach(p => p.classList.toggle("hidden", p.dataset.pane !== name));
    });
  });

  // --- Bottom-bar stack navigation ---
  // The stack-scroller snaps vertically between 4 stacks. The dots on the
  // left mirror which stack is currently in view AND let the user jump
  // directly to a stack by tapping. We use IntersectionObserver instead of
  // a scroll listener because snap-scroll doesn't reliably emit scroll
  // events in some browsers (notably Edge on Windows).
  function setActiveStack(name) {
    stackNav.querySelectorAll("button").forEach(b =>
      b.classList.toggle("active", b.dataset.stack === name)
    );
    stackScroller.querySelectorAll(".stack").forEach(s =>
      s.classList.toggle("active", s.dataset.stack === name)
    );
  }
  function updateStackNav() {
    // Pick whichever stack is active (visible). If none, default to "edit".
    const active = stackScroller.querySelector(".stack.active");
    setActiveStack(active ? active.dataset.stack : "edit");
  }

  // Stack nav dot tap: switch the visible stack.
  stackNav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-stack]");
    if (!btn) return;
    setActiveStack(btn.dataset.stack);
  });

  // Vertical swipe on the stack scroller cycles through stacks.
  // (Replaces the old scroll-snap approach — no overflow, no snap,
  // just display: none vs display: grid.)
  {
    const SWIPE_THRESHOLD = 30;
    const stackNames = [...stackScroller.querySelectorAll(".stack")].map(s => s.dataset.stack);
    let startY = null;
    let swiped = false;
    stackScroller.addEventListener("touchstart", (e) => {
      startY = e.changedTouches[0].clientY;
      swiped = false;
    }, { passive: true });
    stackScroller.addEventListener("touchmove", (e) => {
      if (startY === null || swiped) return;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dy) > SWIPE_THRESHOLD) {
        swiped = true;
        const active = stackScroller.querySelector(".stack.active");
        const idx = stackNames.indexOf(active?.dataset.stack ?? stackNames[0]);
        const next = dy < 0
          ? Math.min(idx + 1, stackNames.length - 1)
          : Math.max(idx - 1, 0);
        setActiveStack(stackNames[next]);
      }
    }, { passive: true });
  }

  function init() {
    if (__destroyed) return;
    renderPresetButtons();
    syncInsPopup(); // display-only; doesn't create a synth
    applyActiveChannelStyle();
    renderChannelStrip();
    renderKeys();
    renderGrid();
    positionKnobFromCursor();
    updateSelectedBar();
    updateStackNav();
    scrollPianoTo("C4");
    __resizeHandler = () => {
      renderKeys(); renderGrid(); positionKnobFromCursor();
    };
    window.addEventListener("resize", __resizeHandler);
  }
  __raf = requestAnimationFrame(init);
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
    // live outside `root` so root.innerHTML='' wouldn't catch them.
    try {
      document.querySelectorAll('[data-seq-popover]').forEach((el) => el.remove());
    } catch (_) {}
    root.innerHTML = '';
  };
}
