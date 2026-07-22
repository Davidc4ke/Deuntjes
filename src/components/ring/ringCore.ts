// The Ritual Ring engine — a faithful port of the approved mockup
// (public/mockups/ring-sequencer.html) into a mountable module. The mockup
// stays frozen as the design artifact; THIS file is the live source.
//
// Differences from the mockup, all deliberate:
//  - mountRing(container, opts) instead of page-global script; everything
//    lives in the closure and destroy() tears it down.
//  - Persistent state (per-lane preset/kit/bars/steps/params) lives on the
//    track objects and serializes to RingSongState; opts.onChange fires
//    after every persistent mutation (the host debounces the save).
//  - Turn locking: opts.editableChannelId restricts carving to the dealt
//    game channel's lanes; foreign lanes stay viewable and audible.
//    opts.readOnly locks every lane (finished-song view).
//  - Two extra drum kits (Grave 909, Ritual Hand) beyond the mockup's two.
//  - iOS media-kick (silent looping <audio>) so the ring plays through the
//    ringer switch, same trick as the legacy editor.

import {
  type ChordCfg,
  type RingEvent,
  type RingSongState,
  type RingTrack,
  RING_CHANNEL_PRESETS,
  RING_CHORD_PRESETS,
  RING_DRUM_KITS,
  RING_MELODIC_PRESETS,
  RING_SPEEDS,
  RING_SPEED_ORDER,
  normalizeRingState,
} from '@/lib/ringState';

export type RingMountOptions = {
  initialState: RingSongState;
  onChange?: (state: RingSongState) => void;
  // Game turn mode: only lanes of this channel are editable. null/undefined
  // (and readOnly false) = free play, everything editable.
  editableChannelId?: number | null;
  readOnly?: boolean;
};

export type RingHandle = {
  destroy(): void;
  getState(): RingSongState;
};

type LiveTrack = RingTrack & { pat: string };

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mountRing(container: HTMLElement, opts: RingMountOptions): RingHandle {
  // ================= notes, chords =================
  const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const parseN = (n: string) => {
    const m = /^([A-G]#?)(\d)$/.exec(n)!;
    return { semi: NOTE_ORDER.indexOf(m[1]), oct: +m[2] };
  };
  const midi = (n: string) => {
    const p = parseN(n);
    return (p.oct + 1) * 12 + p.semi;
  };
  const fromMidi = (v: number) => NOTE_ORDER[v % 12] + (Math.floor(v / 12) - 1);
  const noteFreq = (n: string) => 440 * Math.pow(2, (midi(n) - 69) / 12);
  const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

  const CHORD_QUALITIES = [
    { id: 'maj', label: 'maj', suffix: '', iv: [0, 4, 7] }, { id: 'min', label: 'min', suffix: 'm', iv: [0, 3, 7] },
    { id: '7', label: '7', suffix: '7', iv: [0, 4, 7, 10] }, { id: 'maj7', label: 'maj7', suffix: 'M7', iv: [0, 4, 7, 11] },
    { id: 'm7', label: 'm7', suffix: 'm7', iv: [0, 3, 7, 10] }, { id: '6', label: '6', suffix: '6', iv: [0, 4, 7, 9] },
    { id: 'm6', label: 'm6', suffix: 'm6', iv: [0, 3, 7, 9] }, { id: 'sus2', label: 'sus2', suffix: 'sus2', iv: [0, 2, 7] },
    { id: 'sus4', label: 'sus4', suffix: 'sus4', iv: [0, 5, 7] }, { id: 'dim', label: 'dim', suffix: 'dim', iv: [0, 3, 6] },
    { id: 'dim7', label: 'dim7', suffix: '°7', iv: [0, 3, 6, 9] }, { id: 'm7b5', label: 'm7♭5', suffix: 'ø7', iv: [0, 3, 6, 10] },
    { id: 'aug', label: 'aug', suffix: '+', iv: [0, 4, 8] }, { id: '5', label: '5', suffix: '5', iv: [0, 7] },
    { id: 'add9', label: 'add9', suffix: 'add9', iv: [0, 4, 7, 14] }, { id: '9', label: '9', suffix: '9', iv: [0, 4, 7, 10, 14] },
    { id: 'maj9', label: 'maj9', suffix: 'M9', iv: [0, 4, 7, 11, 14] }, { id: 'm9', label: 'm9', suffix: 'm9', iv: [0, 3, 7, 10, 14] },
    { id: '11', label: '11', suffix: '11', iv: [0, 4, 7, 10, 14, 17] }, { id: '13', label: '13', suffix: '13', iv: [0, 4, 7, 10, 14, 21] },
  ];
  const INVERSIONS = ['root', '1st', '2nd'];
  function buildChord(cfg: ChordCfg, len = 4): RingEvent {
    const q = CHORD_QUALITIES.find((x) => x.id === cfg.qual) ?? CHORD_QUALITIES[0];
    const root = (cfg.oct + 1) * 12 + NOTE_ORDER.indexOf(cfg.root);
    const vals = q.iv.map((i) => root + i);
    for (let i = 0; i < Math.min(cfg.inv, vals.length - 1); i++) vals[i] += 12;
    vals.sort((a, b) => a - b);
    return { label: cfg.root + q.suffix, notes: vals.map(fromMidi), len, vol: 1, cfg: clone(cfg) };
  }
  const N = (label: string, len = 1, vol = 1): RingEvent => ({ label, notes: [label], len, vol });

  // ================= lanes & presets =================
  const DRUM_KITS = RING_DRUM_KITS;
  const TIMBRE: Record<string, [OscillatorType, number]> = {
    Kick: ['sine', .1], '808': ['sine', .3], Snare: ['square', .05], Clap: ['square', .06],
    Hat: ['square', .03], 'Open Hat': ['square', .12], Tom: ['sine', .12], Perc: ['sine', .06],
    Rim: ['square', .03], Crash: ['sawtooth', .4], Ride: ['sawtooth', .2],
    Bass: ['square', .16], Sub: ['sine', .2], Acid: ['sawtooth', .12], Reese: ['sawtooth', .2],
    Lead: ['triangle', .15], Pluck: ['triangle', .08], Bell: ['sine', .35], Marimba: ['sine', .12], Keys: ['triangle', .18],
    Pad: ['sine', .4], Organ: ['square', .3], Strings: ['sawtooth', .38], Choir: ['sine', .45],
  };
  // Which stones the instrument wheel offers a lane. Game channels keep the
  // strict track-type lists; lanes without a channel restriction fall back
  // to the full melodic/chord palette.
  const presetChoices = (t: LiveTrack): string[] => {
    if (t.kind === 'drum') return DRUM_KITS[t.drumKit ?? 'Bone Kit'] ?? DRUM_KITS['Bone Kit'];
    return RING_CHANNEL_PRESETS[t.channelId] ?? (t.kind === 'chord' ? RING_CHORD_PRESETS : RING_MELODIC_PRESETS);
  };

  const BARS_CHOICES = [1, 2, 3];
  const readOnly = opts.readOnly === true;
  const lockCh = opts.editableChannelId ?? null;
  const canEdit = (t: LiveTrack) => !readOnly && (lockCh === null || t.channelId === lockCh);

  const song = normalizeRingState(opts.initialState);
  const tracks: LiveTrack[] = song.tracks.map((t, i) => ({ ...clone(t), pat: 'pat-' + (i % 5) }));
  const firstEditable = tracks.find((t) => canEdit(t)) ?? tracks[0];

  const state: any = {
    tracks,
    activeKey: firstEditable.key,
    hidden: new Set<string>(),
    stickyEv: {} as Record<string, RingEvent>,
    chordCfg: { root: 'C', qual: 'min', oct: 3, inv: 0 } as ChordCfg,
    sel: null as number | null,
    cursor: 0,
    focusedBar: 0,
    view: 'steps',
    instTab: 'voice',
    pickTab: 'notes', // bottom bar tab: 'notes' | 'timing' | 'shape'
    stepTab: 'voice', // param group inside the shape tab
  };
  tracks.forEach((t) => {
    state.stickyEv[t.key] = t.kind === 'chord'
      ? buildChord({ root: 'C', qual: 'min', oct: 3, inv: 0 })
      : N(t.kind === 'drum' ? 'C2' : 'C4');
  });

  // 16 steps per bar for everyone; channels differ in how many BARS they loop
  // and how FAST their clock runs. The master step comes from the dungeon's
  // sealed bpm; each master step is subdivided into SUB=24 subticks so every
  // speed in RING_SPEEDS (1/8x .. 4x) lands on exact integer periods. The
  // transport walks subticks over the LCM of all lane cycles.
  const BPM = song.bpm || 120;
  const STEP_MS = 60000 / BPM / 4; // one master 16th
  const SUB = 24;
  const trackSteps = (t: LiveTrack) => t.barsN * 16;
  // subticks between two of this lane's steps
  const period = (t: LiveTrack) => {
    const s = RING_SPEEDS[t.speed] ?? RING_SPEEDS['1'];
    return (SUB * s.den) / s.num;
  };
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
  const trackCycleQ = (t: LiveTrack) => trackSteps(t) * period(t);
  const songCycleQ = () => state.tracks.reduce((l: number, t: LiveTrack) => lcm(l, trackCycleQ(t)), SUB);
  const active = (): LiveTrack => state.tracks.find((t: LiveTrack) => t.key === state.activeKey);
  const others = (): LiveTrack[] => state.tracks.filter((t: LiveTrack) => t.key !== state.activeKey && !state.hidden.has(t.key));

  const stepAt = (t: LiveTrack, s: number): RingEvent | undefined => t.steps[String(s)];

  // ---- persistence: strip runtime fields, hand the host a clean snapshot
  function serialize(): RingSongState {
    return {
      format: 'ring',
      bpm: song.bpm,
      tracks: state.tracks.map((t: LiveTrack) => {
        const { pat: _pat, ...rest } = t;
        return clone(rest);
      }),
    };
  }
  function commit() {
    if (opts.onChange) opts.onChange(serialize());
  }

  // ================= audio =================
  let AC: AudioContext | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let FXBUS: { conv: ConvolverNode; dly: DelayNode } | null = null;
  // iOS mutes plain WebAudio while the ringer switch is on silent; a looping
  // silent <audio> flips the session into "playback" mode which ignores it.
  let mediaKick: HTMLAudioElement | null = null;
  function ensureAC(): AudioContext {
    if (!AC) {
      AC = new (window.AudioContext || (window as any).webkitAudioContext)();
      try {
        mediaKick = document.createElement('audio');
        mediaKick.setAttribute('playsinline', '');
        mediaKick.loop = true;
        mediaKick.src =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const p = mediaKick.play();
        if (p && p.catch) p.catch(() => {});
      } catch {
        mediaKick = null;
      }
      // iOS suspends/"interrupts" the context on app switch, phone calls, etc.
      // Whenever it drops out of running while we're foreground, try to bring
      // it back so playback doesn't die silently.
      AC.addEventListener('statechange', () => {
        if (AC && AC.state !== 'running' && document.visibilityState === 'visible') {
          AC.resume().catch(() => {});
        }
      });
    }
    if (AC.state !== 'running') AC.resume().catch(() => {});
    return AC;
  }
  // Backgrounding on iOS suspends WebAudio AND pauses the silent media-kick
  // (which is what keeps sound alive through the ringer switch). On return to
  // the foreground, wake both — otherwise coming back to the app leaves the
  // ring mute until the next fresh gesture.
  function resumeAudio() {
    if (!AC) return;
    if (AC.state !== 'running') AC.resume().catch(() => {});
    if (mediaKick) {
      const p = mediaKick.play();
      if (p && p.catch) p.catch(() => {});
    }
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') resumeAudio();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', resumeAudio);
  window.addEventListener('pageshow', resumeAudio);
  // shared send effects: a real (generated-impulse) reverb and a feedback delay
  function fxBus() {
    const ac = AC!;
    if (FXBUS) return FXBUS;
    const len = Math.floor(ac.sampleRate * 1.6);
    const imp = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    const conv = ac.createConvolver();
    conv.buffer = imp;
    conv.connect(ac.destination);
    const dly = ac.createDelay(1);
    dly.delayTime.value = .28;
    const fb = ac.createGain();
    fb.gain.value = .38;
    dly.connect(fb);
    fb.connect(dly);
    dly.connect(ac.destination);
    FXBUS = { conv, dly };
    return FXBUS;
  }
  // per-hit channel chain: drive -> 3-band EQ -> pan -> dry out + fx sends.
  // Everything in the Voice/Tone/EQ/FX tabs is audible through this.
  function chain(P: any): GainNode {
    const ac = AC!;
    const inG = ac.createGain();
    let node: AudioNode = inG;
    if (P.drive > .01) {
      const sh = ac.createWaveShaper();
      const k = P.drive * 70, curve = new Float32Array(257);
      for (let i = 0; i < 257; i++) {
        const x = i / 128 - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      sh.curve = curve;
      const trim = ac.createGain();
      trim.gain.value = 1 / (1 + P.drive * 1.4);
      node.connect(sh);
      sh.connect(trim);
      node = trim;
    }
    const eq = ([
      ['lowshelf', 200, (P.low - .5) * 18],
      ['peaking', 1000, (P.mid - .5) * 15],
      ['highshelf', 4200, (P.high - .5) * 18],
    ] as Array<[BiquadFilterType, number, number]>).map(([type, f, g]) => {
      const b = ac.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.gain.value = g;
      return b;
    });
    node.connect(eq[0]);
    eq[0].connect(eq[1]);
    eq[1].connect(eq[2]);
    node = eq[2];
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = (P.pan - .5) * 2;
      node.connect(p);
      node = p;
    }
    node.connect(ac.destination);
    const bus = fxBus();
    if (P.reverb > .01) {
      const s = ac.createGain();
      s.gain.value = P.reverb * 1.3;
      node.connect(s);
      s.connect(bus.conv);
    }
    if (P.delay > .01) {
      const s = ac.createGain();
      s.gain.value = P.delay * .9;
      node.connect(s);
      s.connect(bus.dly);
    }
    return inG;
  }
  function noiseSrc(): AudioBufferSourceNode {
    const ac = AC!;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    return s;
  }
  // Drums carry pitch: `factor` scales every voice from its C2 home.
  // `vol` is the step's own velocity; P.volume the channel fader.
  function drumVoice(name: string, t: number, factor: number, P: any, vol = 1) {
    const ac = AC!;
    const dest = chain(P); // EQ / pan / drive / reverb / delay all apply
    // Voice-tab ADSR now shapes drums too: an outer VCA gate over the whole
    // hit. attack softens the transient; decay+sustain set how long the hit
    // rings at full level; release fades the tail. Defaults give a ~1.05s
    // gate — longer than every kit voice, so the stock sound is untouched —
    // while lowering decay/sustain/release tightens a hit (short hats,
    // clipped kicks) and raising attack blunts the crack.
    const out = ac.createGain();
    const atkSec = 0.001 + P.attack * 0.1;
    const holdSec = 0.04 + (P.decay + P.sustain) * 0.95;
    const relSec = 0.005 + P.release * 0.8;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + atkSec);
    out.gain.setValueAtTime(1, t + atkSec + holdSec);
    out.gain.linearRampToValueAtTime(0.0001, t + atkSec + holdSec + relSec);
    out.connect(dest);
    const rv = 1;
    // channel fader only — the ADSR VCA owns the shaping now
    const vg = vol * (P.volume / .8);
    const envGain = (tt: number, peak: number, dur: number) => {
      const g = ac.createGain();
      g.gain.setValueAtTime(Math.max(.001, peak * vg), tt);
      g.gain.exponentialRampToValueAtTime(.001, tt + dur);
      return g;
    };
    const osc = (type: OscillatorType, freq: number) => {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      return o;
    };
    switch (name) {
      case '808 Kick': {
        const o = osc('sine', 160 * factor);
        o.frequency.setValueAtTime(160 * factor, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(28, 45 * factor), t + .12);
        const g = envGain(t, .5, .5 * rv);
        o.connect(g).connect(out); o.start(t); o.stop(t + .55 * rv); break;
      }
      case '808 Snare': {
        const o = osc('triangle', 185 * factor);
        const g = envGain(t, .22, .18 * rv);
        o.connect(g).connect(out); o.start(t); o.stop(t + .25 * rv);
        const n = noiseSrc();
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
        const g2 = envGain(t, .28, .2 * rv);
        n.connect(hp); hp.connect(g2).connect(out); n.start(t); n.stop(t + .25 * rv); break;
      }
      case '808 Clap': {
        for (let k = 0; k < 3; k++) {
          const n = noiseSrc();
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
          bp.frequency.value = 1200 * factor; bp.Q.value = 1.5;
          const tt = t + k * .012;
          const g = envGain(tt, .26, k === 2 ? .25 * rv : .03);
          n.connect(bp); bp.connect(g).connect(out); n.start(tt); n.stop(tt + .3 * rv);
        }
        break;
      }
      case '808 Hat': case '808 Open': {
        const dur = (name === '808 Open' ? .4 : .06) * rv;
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
        const g = envGain(t, .14, dur);
        hp.connect(g).connect(out);
        [2, 3, 4.16, 5.43, 6.79, 8.21].forEach((r) => {
          const o = osc('square', 80 * r * factor);
          o.connect(hp); o.start(t); o.stop(t + dur + .05);
        });
        break;
      }
      case '808 Tom': {
        const o = osc('sine', 200 * factor);
        o.frequency.setValueAtTime(200 * factor, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(40, 90 * factor), t + .2);
        const g = envGain(t, .32, .3 * rv);
        o.connect(g).connect(out); o.start(t); o.stop(t + .38 * rv); break;
      }
      case 'Cowbell': {
        [540, 800].forEach((fq) => {
          const o = osc('square', fq * factor);
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800 * factor;
          const g = envGain(t, .2, .25 * rv);
          o.connect(bp); bp.connect(g).connect(out); o.start(t); o.stop(t + .35 * rv);
        });
        break;
      }
      case 'Rimshot': {
        const o = osc('square', 1700 * factor);
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700 * factor; bp.Q.value = 8;
        const g = envGain(t, .3, .05);
        o.connect(bp); bp.connect(g).connect(out); o.start(t); o.stop(t + .1); break;
      }
      case 'Maracas': {
        const n = noiseSrc();
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
        const g = envGain(t, .18, .05 * rv);
        n.connect(hp); hp.connect(g).connect(out); n.start(t); n.stop(t + .1); break;
      }
      // ---- Grave 909: punchier, snappier machine ----
      case '909 Kick': {
        const o = osc('sine', 210 * factor);
        o.frequency.setValueAtTime(210 * factor, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(30, 52 * factor), t + .055);
        const g = envGain(t, .55, .32);
        o.connect(g).connect(out); o.start(t); o.stop(t + .4);
        const n = noiseSrc();
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
        const g2 = envGain(t, .18, .02);
        n.connect(hp); hp.connect(g2).connect(out); n.start(t); n.stop(t + .05); break;
      }
      case '909 Snare': {
        [175, 224].forEach((fq) => {
          const o = osc('triangle', fq * factor);
          const g = envGain(t, .18, .11);
          o.connect(g).connect(out); o.start(t); o.stop(t + .15);
        });
        const n = noiseSrc();
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
        const g = envGain(t, .3, .16);
        n.connect(hp); hp.connect(g).connect(out); n.start(t); n.stop(t + .22); break;
      }
      case '909 Clap': {
        for (let k = 0; k < 4; k++) {
          const n = noiseSrc();
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
          bp.frequency.value = 1000 * factor; bp.Q.value = 1.2;
          const tt = t + k * .009;
          const g = envGain(tt, .24, k === 3 ? .3 : .025);
          n.connect(bp); bp.connect(g).connect(out); n.start(tt); n.stop(tt + .35);
        }
        break;
      }
      case '909 Hat': case '909 Open': {
        const dur = name === '909 Open' ? .45 : .05;
        const n = noiseSrc();
        const hp = ac.createBiquadFilter(); hp.type = 'highpass';
        hp.frequency.value = 8000 * Math.sqrt(factor);
        const g = envGain(t, .16, dur);
        n.connect(hp); hp.connect(g).connect(out); n.start(t); n.stop(t + dur + .05); break;
      }
      case '909 Ride': {
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
        const g = envGain(t, .09, .5);
        hp.connect(g).connect(out);
        [3.1, 4.7, 5.9].forEach((r) => {
          const o = osc('square', 300 * r * factor);
          o.connect(hp); o.start(t); o.stop(t + .55);
        });
        const n = noiseSrc();
        const hp2 = ac.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 6500;
        const g2 = envGain(t, .07, .45);
        n.connect(hp2); hp2.connect(g2).connect(out); n.start(t); n.stop(t + .5); break;
      }
      case '909 Crash': {
        const n = noiseSrc();
        const hp = ac.createBiquadFilter(); hp.type = 'highpass';
        hp.frequency.value = 4200 * Math.sqrt(factor);
        const g = envGain(t, .2, .9);
        n.connect(hp); hp.connect(g).connect(out); n.start(t); n.stop(t + .95); break;
      }
      case 'Zap': {
        const o = osc('sawtooth', 1400 * factor);
        o.frequency.setValueAtTime(1400 * factor, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(40, 60 * factor), t + .09);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 8;
        const g = envGain(t, .3, .12);
        o.connect(lp); lp.connect(g).connect(out); o.start(t); o.stop(t + .18); break;
      }
      // ---- Ritual Hand: skins, wood and shells ----
      case 'Djembe': {
        const o = osc('sine', 180 * factor);
        o.frequency.setValueAtTime(180 * factor, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(50, 95 * factor), t + .12);
        const g = envGain(t, .38, .28);
        o.connect(g).connect(out); o.start(t); o.stop(t + .35);
        const n = noiseSrc();
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1;
        const g2 = envGain(t, .12, .025);
        n.connect(bp); bp.connect(g2).connect(out); n.start(t); n.stop(t + .06); break;
      }
      case 'Conga': {
        const o = osc('sine', 230 * factor);
        o.frequency.setValueAtTime(230 * factor, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(80, 205 * factor), t + .06);
        const g = envGain(t, .3, .16);
        o.connect(g).connect(out); o.start(t); o.stop(t + .22); break;
      }
      case 'Bongo': {
        const o = osc('sine', 380 * factor);
        o.frequency.setValueAtTime(380 * factor, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(150, 350 * factor), t + .04);
        const g = envGain(t, .25, .09);
        o.connect(g).connect(out); o.start(t); o.stop(t + .14); break;
      }
      case 'Taiko': {
        const o = osc('sine', 105 * factor);
        o.frequency.setValueAtTime(105 * factor, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(30, 48 * factor), t + .18);
        const g = envGain(t, .5, .55);
        o.connect(g).connect(out); o.start(t); o.stop(t + .65);
        const n = noiseSrc();
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
        const g2 = envGain(t, .2, .05);
        n.connect(lp); lp.connect(g2).connect(out); n.start(t); n.stop(t + .1); break;
      }
      case 'Clave': {
        const o = osc('sine', 1750 * factor);
        const g = envGain(t, .25, .05);
        o.connect(g).connect(out); o.start(t); o.stop(t + .1); break;
      }
      case 'Block': {
        [850, 1300].forEach((fq, i) => {
          const o = osc('sine', fq * factor);
          const g = envGain(t, i === 0 ? .3 : .08, .05);
          o.connect(g).connect(out); o.start(t); o.stop(t + .1);
        });
        break;
      }
      case 'Shaker': {
        const n = noiseSrc();
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1;
        const g = envGain(t, .2, .055);
        n.connect(bp); bp.connect(g).connect(out); n.start(t); n.stop(t + .1); break;
      }
      case 'Tambo': {
        const n = noiseSrc();
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6800;
        const g = envGain(t, .18, .12);
        n.connect(hp); hp.connect(g).connect(out); n.start(t); n.stop(t + .18);
        [4200, 5100].forEach((fq) => {
          const o = osc('square', fq * factor);
          const hp2 = ac.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 4000;
          const g2 = envGain(t, .05, .1);
          o.connect(hp2); hp2.connect(g2).connect(out); o.start(t); o.stop(t + .15);
        });
        break;
      }
      default: {
        // Bone Kit: pitch-aware, noisy voices get real noise
        const base = (TIMBRE[name] || ['sine', .1])[1];
        const noisy = ({ Snare: 1500, Clap: 1200, Hat: 6000, 'Open Hat': 6000, Rim: 3000, Crash: 5000, Ride: 6500 } as Record<string, number>)[name];
        if (noisy) {
          const n = noiseSrc();
          const hp = ac.createBiquadFilter(); hp.type = 'highpass';
          hp.frequency.value = noisy * Math.sqrt(factor);
          const g = envGain(t, .24, base * rv * 2.2);
          n.connect(hp); hp.connect(g).connect(out); n.start(t); n.stop(t + base * rv * 2.2 + .05);
        } else {
          const o = osc('sine', 82 * factor);
          o.frequency.setValueAtTime(Math.max(30, 82 * factor * (name === '808' ? .8 : name === 'Tom' ? 1.6 : name === 'Perc' ? 2.2 : 1)), t);
          o.frequency.exponentialRampToValueAtTime(Math.max(24, 38 * factor), t + .09);
          const g = envGain(t, .3, base * rv * 3);
          o.connect(g).connect(out); o.start(t); o.stop(t + base * rv * 3 + .05);
        }
      }
    }
  }
  function tone(track: LiveTrack, note: string, len = 1, when = 0, vol = 1, pOver?: typeof track.params, octOff = 0) {
    try {
      const ac = ensureAC();
      const P = pOver ?? track.params;
      const t = ac.currentTime + when;
      // lane octave + per-step octave offset, as a frequency multiplier (drums too)
      const octMul = Math.pow(2, (track.octave ?? 0) + octOff);
      if (track.kind === 'drum') {
        drumVoice(track.preset, t, (noteFreq(note) / 65.41) /* C2 */ * octMul, P, vol);
        return;
      }
      const g = ac.createGain(), f = ac.createBiquadFilter();
      const [type] = TIMBRE[track.preset] || ['triangle', .15];
      const fr = noteFreq(note) * octMul;
      f.type = 'lowpass';
      f.frequency.value = 200 + P.cutoff * 9000;
      f.Q.value = 1 + P.resonance * 12;
      // full ADSR: attack -> decay to sustain -> hold for the step length -> release
      const atk = .003 + P.attack * .3;
      const dec = .02 + P.decay * .5;
      const rel = .04 + P.release * 1.2;
      // a "step" of hold time is one of THIS lane's steps at the master bpm
      const laneStepSec = (STEP_MS / 1000) * (period(track) / SUB);
      const hold = Math.max(.02, len * laneStepSec * .9);
      const peak = Math.max(.002, (track.kind === 'chord' ? .12 : .2) * vol * (P.volume / .8));
      const susLvl = Math.max(.0015, peak * P.sustain);
      const tSus = t + atk + dec, tEnd = Math.max(tSus, t + atk + hold);
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + atk);
      g.gain.exponentialRampToValueAtTime(susLvl, tSus);
      g.gain.setValueAtTime(susLvl, tEnd);
      g.gain.exponentialRampToValueAtTime(.001, tEnd + rel);
      const stopAt = tEnd + rel + .05;
      const mkOsc = (detuneCents: number) => {
        const o = ac.createOscillator();
        o.type = type;
        if (P.glide > .01) {
          o.frequency.setValueAtTime(fr / Math.pow(2, P.glide * .6), t);
          o.frequency.exponentialRampToValueAtTime(fr, t + .04 + P.glide * .3);
        } else o.frequency.value = fr;
        o.detune.value = detuneCents;
        o.connect(f);
        o.start(t);
        o.stop(stopAt);
      };
      mkOsc(0);
      if (P.chorus > .02) mkOsc(7 + P.chorus * 18); // detuned twin = audible thickening
      f.connect(g);
      g.connect(chain(P));
    } catch {
      /* audio is best-effort */
    }
  }
  function playEvent(track: LiveTrack, ev: RingEvent, when = 0) {
    // step shaping: sparse per-step overrides merged over the lane params
    const P = ev.params ? { ...track.params, ...ev.params } : track.params;
    const octOff = ev.octave ?? 0;
    ev.notes.forEach((n, i) => tone(track, n, ev.len, when + i * .012, ev.vol ?? 1, P, octOff));
  }

  // ================= animated layout =================
  let L: any = { rings: [], inst: 0 };
  function targetLayout() {
    const f = state.focusedBar;
    const rings: Array<{ r: number; s: number }> = [];
    for (let b = 0; b < active().barsN; b++) {
      if (b === f) rings.push({ r: 146, s: 1 });
      else if (b < f) rings.push({ r: 174 - (f - 1 - b) * 13, s: .42 });
      else rings.push({ r: 146 - 44 * (b - f), s: b - f === 1 ? .6 : .42 });
    }
    return { rings, inst: state.view === 'inst' ? 1 : 0 };
  }
  let animId = 0;
  let destroyed = false;
  function settle(instant = false) {
    const from = clone(L), to = targetLayout();
    while (from.rings.length < to.rings.length) from.rings.push({ r: 40, s: 0 });
    from.rings.length = to.rings.length;
    if (instant) { L = to; renderRing(); return; }
    const id = ++animId, t0 = performance.now(), MS = 260;
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    (function frame(now: number) {
      if (id !== animId || destroyed) return;
      const k = ease(Math.min(1, (now - t0) / MS));
      L = {
        inst: from.inst + (to.inst - from.inst) * k,
        rings: to.rings.map((tr: any, i: number) => ({
          r: from.rings[i].r + (tr.r - from.rings[i].r) * k,
          s: from.rings[i].s + (tr.s - from.rings[i].s) * k,
        })),
      };
      renderRing();
      if (k < 1) requestAnimationFrame(frame);
    })(t0);
  }

  // ================= transport (per-lane bar loops AND clock rates) =======
  // The interval fires once per master step; each firing schedules every lane
  // hit that falls inside the coming step at exact WebAudio offsets, so fast
  // lanes (x2..x4) subdivide the step and slow lanes (1/2..1/8) skip steps.
  let timer: ReturnType<typeof setInterval> | null = null;
  let gQ = -1; // global subtick position over the LCM of all lane cycles
  function stopPlay() {
    if (timer) clearInterval(timer);
    timer = null;
    gQ = -1;
    renderRing();
  }
  function togglePlay() {
    if (timer) { stopPlay(); return; }
    ensureAC();
    let q = (state.cursor % trackSteps(active())) * period(active());
    gQ = q;
    timer = setInterval(() => {
      state.tracks.forEach((t: LiveTrack) => {
        if (state.hidden.has(t.key)) return; // the eye is a true mute
        const per = period(t);
        const cyc = trackCycleQ(t);
        for (let j = 0; j < SUB; j++) {
          const qq = (q + j) % cyc;
          if (qq % per === 0) {
            const ev = stepAt(t, (qq / per) % trackSteps(t));
            if (ev) playEvent(t, ev, (j / SUB) * (STEP_MS / 1000));
          }
        }
      });
      gQ = q;
      const shown = Math.floor(q / period(active())) % trackSteps(active());
      const bar = Math.floor(shown / 16);
      if (bar !== state.focusedBar) { state.focusedBar = bar; settle(); }
      renderRing();
      q = (q + SUB) % songCycleQ();
    }, STEP_MS);
    renderRing();
  }

  // ================= DOM skeleton =================
  container.innerHTML = `
    <div class="ringseq">
      <div class="chips-row">
        <div class="track-chips"></div>
        <button class="icon-chip" data-act="inst" title="Instrument">⚙&#xFE0E;</button>
        <button class="icon-chip" data-act="clear" title="Clear lane">✕</button>
      </div>
      <div class="stage">
        <svg class="fx-layer" viewBox="0 0 372 372"></svg>
        <svg class="main-layer" viewBox="0 0 372 372"></svg>
      </div>
      <div class="pickers">
        <p class="pick-status"></p>
        <div class="pick-body"></div>
      </div>
    </div>`;
  const app = container.firstElementChild as HTMLElement;
  const svg = app.querySelector('.main-layer') as SVGSVGElement;
  const fxLayer = app.querySelector('.fx-layer') as SVGSVGElement;
  const CX = 186, CY = 186, R = 150, orbR = 34;

  // The center control: an engraved bone skull on a blood-iron medallion.
  // mode 'play' (idle) · 'stop' (playing: eyes blaze + rim pulses). One
  // transparent hit circle on top carries the click, so the detailed art
  // stays pointer-inert.
  function skullMedallion(mode: string) {
    const lit = mode === 'stop';
    const hitAttr = 'data-play="1"';
    const ss = 0.68, tx = (CX - 45 * ss).toFixed(1), ty = (CY - 4 - 44.5 * ss).toFixed(1);
    const litC = lit ? ' lit' : '';
    let g = '';
    g += `<circle cx="${CX}" cy="${CY}" r="${orbR + 7}" class="sk-rim ${lit ? 'lit' : 'idle'}"/>`;
    g += `<circle cx="${CX}" cy="${CY}" r="${orbR + 2}" class="sk-disc"/>`;
    // Layered illustration: form gradient → clipped shading (edge AO, temple
    // hollows, red underlight, specular sheen, bone grain) → sutures → sockets
    // with lit upper rims → nasal → mouth cavity + sculpted teeth → embers.
    g += `<g transform="translate(${tx},${ty}) scale(${ss})" pointer-events="none">
      <g style="filter:drop-shadow(0 2.5px 3.5px rgba(0,0,0,.6))">
        <use href="#skSil" fill="url(#skBoneG)" stroke="rgba(24,15,9,.9)" stroke-width="1.1"/>
      </g>
      <g clip-path="url(#skClip)">
        <use href="#skSil" fill="none" stroke="rgba(80,60,38,.6)" stroke-width="5" filter="url(#skB2)"/>
        <ellipse cx="16" cy="35" rx="8" ry="14" fill="rgba(96,76,50,.55)" filter="url(#skB2)"/>
        <ellipse cx="74" cy="35" rx="8" ry="14" fill="rgba(96,76,50,.55)" filter="url(#skB2)"/>
        <ellipse cx="20" cy="61" rx="7.5" ry="6" fill="rgba(80,60,38,.6)" filter="url(#skB2)"/>
        <ellipse cx="70" cy="61" rx="7.5" ry="6" fill="rgba(80,60,38,.6)" filter="url(#skB2)"/>
        <ellipse cx="45" cy="88" rx="27" ry="9" fill="rgba(52,36,20,.55)" filter="url(#skB2)"/>
        <ellipse cx="45" cy="78" rx="24" ry="12" fill="rgba(178,28,22,${lit ? '.55' : '.3'})" filter="url(#skB2)"/>
        <ellipse cx="34" cy="14.5" rx="15" ry="7.5" fill="rgba(255,252,240,.75)" filter="url(#skB2)"/>
        <ellipse cx="25.5" cy="31" rx="5.5" ry="3" fill="rgba(255,252,240,.5)" filter="url(#skB1)"/>
        <ellipse cx="63" cy="29" rx="4.5" ry="2.6" fill="rgba(255,252,240,.32)" filter="url(#skB1)"/>
        <ellipse cx="15.5" cy="54" rx="3.6" ry="2" fill="rgba(255,252,240,.45)" filter="url(#skB1)"/>
        <ellipse cx="74.5" cy="54" rx="3.6" ry="2" fill="rgba(255,252,240,.32)" filter="url(#skB1)"/>
        <use href="#skSil" fill="#241a10" filter="url(#skGrainF)" opacity=".3"/>
      </g>
      <path class="sk3-crack" d="M22 21 Q30 16.5 37 20 Q44 23.5 51 19 Q58 15 66 20"/>
      <path class="sk3-crack${litC}" d="M64 13 L60.5 20 L63 26 L59.5 32"/>
      <path class="sk3-crack" d="M13 51 C16.5 54.5 20.5 56 24.5 55.5"/>
      <path class="sk3-crack" d="M77 51 C73.5 54.5 69.5 56 65.5 55.5"/>
      <path d="M17.5 43 C19.5 35.5 30.5 33.5 37.5 40.5 C39.6 45.8 36.6 52.7 28.8 53.2 C21.2 53.7 15.9 49.3 17.5 43 Z" fill="url(#skSocketG)"/>
      <path d="M72.5 43 C70.5 35.5 59.5 33.5 52.5 40.5 C50.4 45.8 53.4 52.7 61.2 53.2 C68.8 53.7 74.1 49.3 72.5 43 Z" fill="url(#skSocketG)"/>
      <path d="M18.8 41.2 C21.6 35.8 30.4 34.6 36.4 39.6" fill="none" stroke="rgba(253,248,234,.55)" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M71.2 41.2 C68.4 35.8 59.6 34.6 53.6 39.6" fill="none" stroke="rgba(253,248,234,.4)" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M45 54.5 C42.6 60 40.4 64 41.4 67.6 C42.1 70 44 71 45 71 C46 71 47.9 70 48.6 67.6 C49.6 64 47.4 60 45 54.5 Z" fill="url(#skSocketG)"/>
      <path d="M44.4 56.5 C42.6 60.6 41.4 63.8 42.1 66.6" fill="none" stroke="rgba(253,248,234,.35)" stroke-width=".9" stroke-linecap="round"/>
      <path d="M29.5 72.8 C34 71.3 56 71.3 60.5 72.8 L60 81.6 C55.8 84.8 34.2 84.8 30 81.6 Z" fill="${lit ? 'url(#skMouthG)' : '#140c07'}"/>
      ${lit ? '<ellipse cx="45" cy="81" rx="13" ry="4.5" fill="rgba(255,80,36,.5)" filter="url(#skB2)" class="sk3-pulse"/>' : ''}
      <rect x="31.4" y="72.6" width="4" height="8.6" rx="1.9" fill="url(#skToothG)" stroke="rgba(40,26,14,.55)" stroke-width=".5"/>
      <rect x="36" y="72.6" width="4.1" height="9.8" rx="1.9" fill="url(#skToothG)" stroke="rgba(40,26,14,.55)" stroke-width=".5"/>
      <rect x="40.7" y="72.6" width="4.2" height="10.8" rx="2" fill="url(#skToothG)" stroke="rgba(40,26,14,.55)" stroke-width=".5"/>
      <rect x="45.5" y="72.6" width="4.2" height="10.8" rx="2" fill="url(#skToothG)" stroke="rgba(40,26,14,.55)" stroke-width=".5"/>
      <rect x="50.3" y="72.6" width="4.1" height="9.8" rx="1.9" fill="url(#skToothG)" stroke="rgba(40,26,14,.55)" stroke-width=".5"/>
      <rect x="54.9" y="72.6" width="4" height="8.6" rx="1.9" fill="url(#skToothG)" stroke="rgba(40,26,14,.55)" stroke-width=".5"/>
      ${lit ? `<g class="sk3-pulse">
        <circle cx="28.3" cy="45" r="5.6" fill="#ff3a1f" filter="url(#skB2)" opacity=".9"/>
        <circle cx="61.7" cy="45" r="5.6" fill="#ff3a1f" filter="url(#skB2)" opacity=".9"/>
        <circle cx="28.3" cy="45" r="2" fill="#ffd9a8"/>
        <circle cx="61.7" cy="45" r="2" fill="#ffd9a8"/>
        <circle cx="45" cy="64.5" r="2.1" fill="#ff3a1f" filter="url(#skB1)" opacity=".75"/>
      </g>` : ''}
    </g>`;
    const cyc = CY + orbR + 1;
    g += `<circle cx="${CX}" cy="${cyc}" r="10.5" class="sk-chip" pointer-events="none"/>`;
    if (mode === 'stop') g += `<rect x="${CX - 4}" y="${cyc - 4}" width="8" height="8" rx="1.5" class="sk-glyph" pointer-events="none"/>`;
    else g += `<path d="M${CX - 3.5} ${cyc - 5} L${CX + 5} ${cyc} L${CX - 3.5} ${cyc + 5} Z" class="sk-glyph" pointer-events="none"/>`;
    g += `<circle cx="${CX}" cy="${CY + 5}" r="${orbR + 12}" class="sk-hit" ${hitAttr}/>`;
    return g;
  }
  // position of step i on a ring subdivided into `div` beats
  const posOf = (i: number, div: number, r: number) => {
    const a = ((-90 + i * (360 / div)) * Math.PI) / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  const polar = (deg: number, r: number) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)];
  function arcPath(r: number, a0: number, a1: number) {
    const [x0, y0] = polar(a0, r), [x1, y1] = polar(a1, r);
    return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  }
  // static decorative layer: rendered ONCE so the spin never restarts
  fxLayer.innerHTML = `
    <g class="spin-slow" style="transform-origin:${CX}px ${CY}px"><circle cx="${CX}" cy="${CY}" r="${R + 24}" class="b-rune-ring"/>
      <path d="M${CX} ${CY - R - 32} l4 6 -4 6 -4 -6 Z" fill="rgba(242,237,227,.3)"/>
      <path d="M${CX} ${CY + R + 32} l4 -6 -4 -6 -4 6 Z" fill="rgba(242,237,227,.3)"/></g>
    <g class="spin-rev" style="transform-origin:${CX}px ${CY}px"><circle cx="${CX}" cy="${CY}" r="${R + 12}" class="b-rune-ring r2"/></g>`;

  function renderRing() {
    const t = active();
    const div = 16;
    const shownStep = (timer ? Math.floor(gQ / period(t)) : state.cursor) % trackSteps(t);
    const shownBar = Math.floor(shownStep / 16);
    const playStep = timer ? shownStep : -1;
    const stepsAlpha = 1 - L.inst;
    let out = `<defs>
      <radialGradient id="playGrad" cx="38%" cy="30%">
        <stop offset="0%" stop-color="#e5473a"/><stop offset="55%" stop-color="#a01818"/><stop offset="100%" stop-color="#4a0b0b"/>
      </radialGradient>
      <radialGradient id="skullGrad" cx="42%" cy="34%">
        <stop offset="0%" stop-color="#5e1616"/><stop offset="52%" stop-color="#280a0a"/><stop offset="100%" stop-color="#0b0303"/>
      </radialGradient>
      <radialGradient id="chipGrad" cx="38%" cy="30%">
        <stop offset="0%" stop-color="#e5473a"/><stop offset="55%" stop-color="#a01818"/><stop offset="100%" stop-color="#4a0b0b"/>
      </radialGradient>
      <radialGradient id="skBoneG" cx="38%" cy="26%" r="85%">
        <stop offset="0%" stop-color="#fdf9ee"/><stop offset="45%" stop-color="#ece2c8"/>
        <stop offset="75%" stop-color="#cbbc9c"/><stop offset="100%" stop-color="#8e7f61"/>
      </radialGradient>
      <radialGradient id="skSocketG" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stop-color="#060302"/><stop offset="55%" stop-color="#170d07"/><stop offset="100%" stop-color="#42301d"/>
      </radialGradient>
      <linearGradient id="skToothG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#efe6ce"/><stop offset="70%" stop-color="#d6c8a6"/><stop offset="100%" stop-color="#a8987a"/>
      </linearGradient>
      <radialGradient id="skMouthG" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="#ff5a2e"/><stop offset="60%" stop-color="#b31f10"/><stop offset="100%" stop-color="#2a0503"/>
      </radialGradient>
      <filter id="skB1" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.4"/></filter>
      <filter id="skB2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="skGrainF">
        <feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .9 .9 .9 0 0" result="a"/>
        <feComposite in="a" in2="SourceGraphic" operator="in"/>
      </filter>
      <path id="skSil" d="M45 3 C28 3 13.5 14 11.5 32 C10.8 40 12 46 14 50 C11.5 52 10.2 55 11.5 58 C12.5 62 15 65 19 66 C20.5 68.5 21 71 22 74 C23 79 25.5 83 31 84.5 C36 86 54 86 59 84.5 C64.5 83 67 79 68 74 C69 71 69.5 68.5 71 66 C75 65 77.5 62 78.5 58 C79.8 55 78.5 52 76 50 C78 46 79.2 40 78.5 32 C76.5 14 62 3 45 3 Z"/>
      <clipPath id="skClip"><use href="#skSil"/></clipPath>
    </defs>`;

    if (stepsAlpha > 0.02) {
      out += `<g opacity="${stepsAlpha}">`;
      const carved = Object.keys(t.steps).map(Number).filter((s) => s < trackSteps(t)).sort((a, b) => a - b);
      // length arcs (len in this channel's own beats)
      carved.forEach((s) => {
        const ev = stepAt(t, s)!;
        if (ev.len > 1) {
          const ring = L.rings[Math.floor(s / div)];
          const a0 = -90 + (s % div) * (360 / div) + 5, a1 = -90 + ((s % div) + ev.len) * (360 / div) - 7;
          if (ring && a1 > a0) out += `<path d="${arcPath(ring.r, a0, a1)}" class="b-lenarc" style="stroke-width:${5 * ring.s}"/>`;
        }
      });
      // ghosts on the focused ring — each other channel shows the bar of ITS
      // loop that lines up (modulo its own length)
      {
        const fr = L.rings[state.focusedBar];
        if (fr) {
          const gr = fr.r - 19 * fr.s - 10;
          others().forEach((o) => {
            const ob = state.focusedBar % o.barsN;
            for (let i = 0; i < 16; i++) {
              if (stepAt(o, ob * 16 + i)) {
                const [x, y] = posOf(i, 16, gr);
                out += `<circle cx="${x}" cy="${y}" r="3" class="b-ghost"/>`;
              }
            }
          });
        }
      }
      // hand + cursor notch
      {
        const ring = L.rings[shownBar] || L.rings[0];
        const handA = ((-90 + ((shownStep % 16) / 16) * 360) * Math.PI) / 180;
        const hr = ring.r - 20 * ring.s - 5;
        out += `<line x1="${CX}" y1="${CY}" x2="${CX + hr * Math.cos(handA)}" y2="${CY + hr * Math.sin(handA)}" class="b-hand ${timer ? '' : 'idle'}"/>`;
        const c = state.cursor % trackSteps(t);
        const cring = L.rings[Math.floor(c / div)] || L.rings[0];
        const [nx, ny] = posOf(c % div, div, cring.r);
        out += `<circle cx="${nx}" cy="${ny}" r="${19 * cring.s + 5}" class="b-cursor-notch"/>`;
      }
      // stones: one ring per bar of the active channel's loop
      L.rings.forEach((ring: any, bar: number) => {
        if (bar !== state.focusedBar) {
          out += `<circle cx="${CX}" cy="${CY}" r="${ring.r}" stroke-width="${Math.max(26, 40 * ring.s)}" class="b-focusring" data-focus="${bar}"/>`;
        }
        for (let i = 0; i < div; i++) {
          const s = bar * div + i;
          const ev = stepAt(t, s);
          const [x, y] = posOf(i, div, ring.r);
          const accent = i % 4 === 0;
          const rr = (accent ? 19 : 16) * ring.s;
          const volStyle = ev && (ev.vol ?? 1) < 1 ? ` style="fill-opacity:${.4 + .6 * (ev.vol ?? 1)}"` : '';
          out += `<circle cx="${x}" cy="${y}" r="${rr}" data-s="${s}"${volStyle} class="b-step ${accent ? 'accent' : ''} ${ev ? 'on' : ''} ${state.sel === s ? 'sel' : ''} ${playStep === s ? 'playhead' : ''}"/>`;
          if (bar === state.focusedBar && ring.s > .8) {
            const fs = 10.5 * ring.s;
            if (ev) {
              if (t.kind === 'chord') {
                out += `<text x="${x}" y="${y - 3.5}" class="b-lab on" style="font-size:${fs}px">${ev.label.slice(0, 6)}</text>`;
                out += `<text x="${x}" y="${y + 7}" class="b-lab on" style="font-size:${fs * .62}px;font-family:var(--body);font-style:italic;opacity:.75">${ev.notes.length}v${ev.len > 1 ? '·' + ev.len : ''}</text>`;
              } else {
                out += `<text x="${x}" y="${y}" class="b-lab on" style="font-size:${fs}px">${ev.label}</text>`;
              }
            } else {
              out += `<text x="${x}" y="${y}" class="b-lab" style="font-size:${fs}px">${s + 1}</text>`;
            }
          }
        }
      });
      out += `</g>`;
    }

    // instrument wheel
    if (L.inst > 0.02) {
      const t2 = active();
      const names = presetChoices(t2);
      const wr = 40 + 106 * L.inst;
      out += `<g opacity="${L.inst}">`;
      names.forEach((p, i) => {
        const a = -90 + (360 / names.length) * i;
        const [x, y] = polar(a, wr);
        const cur = t2.preset === p;
        const pr = (names.length > 8 ? 20 : 25) * L.inst;
        out += `<circle cx="${x}" cy="${y}" r="${pr}" class="p-stone ${cur ? 'cur' : ''}" data-preset="${p}"/>`;
        out += `<text x="${x}" y="${y}" class="p-lab ${cur ? 'cur' : ''}" style="font-size:${(p.length > 6 ? 8.5 : 10.5) * L.inst}px">${p}</text>`;
      });
      const P = t2.params;
      const arcs = [
        { key: 'reverb', a0: 115, a1: 163, lab: 'reverb' },
        { key: 'drive', a0: 17, a1: 65, lab: 'drive' },
      ];
      arcs.forEach(({ key, a0, a1, lab }) => {
        const r = wr + 36;
        out += `<path d="${arcPath(r, a0, a1)}" class="fx-arc-bg"/>`;
        const v = (P as any)[key];
        if (v > 0.01) out += `<path d="${arcPath(r, a0, a0 + (a1 - a0) * v)}" class="fx-arc-fill"/>`;
        out += `<path d="${arcPath(r, a0 - 4, a1 + 4)}" class="fx-arc-hit" data-arc="${key}" data-a0="${a0}" data-a1="${a1}"/>`;
        const [lx, ly] = polar((a0 + a1) / 2, r + 17);
        out += `<text x="${lx}" y="${ly}" class="fx-lab">${lab} ${Math.round(v * 100)}</text>`;
      });
      out += `</g>`;
    }

    // center: engraved blood-iron skull medallion. Play/stop EVERYWHERE —
    // in instrument mode too, so parameter changes can be auditioned against
    // the running loop; the wheel closes via the lit gear chip instead.
    out += skullMedallion(timer ? 'stop' : 'play');
    if (state.view === 'inst') {
      const oc = active().octave ?? 0;
      const octTag = oc ? ` · ${oc > 0 ? '+' : ''}${oc} oct` : '';
      out += `<text x="${CX}" y="${CY + orbR + 26}" class="inst-title" style="font-size:14px" pointer-events="none">${active().preset}${octTag}</text>`;
    }
    svg.innerHTML = out;
  }

  // ================= pickers =================
  const pickersEl = app.querySelector('.pickers') as HTMLElement;
  const pickStatus = app.querySelector('.pick-status') as HTMLElement;
  const pickBody = app.querySelector('.pick-body') as HTMLElement;
  let pianoScrolledFor: string | null = null;
  // Animate bottom-bar height changes (view/tab switches) instead of letting
  // the stage snap: measure before/after the rebuild, pin the old height,
  // transition to the new one, then release back to natural flex sizing.
  let pickHeightTimer: ReturnType<typeof setTimeout> | null = null;
  function animatePickHeight(mutate: () => void) {
    const h0 = pickersEl.offsetHeight;
    if (pickHeightTimer) {
      // mid-animation: release the pin so the new natural height measures true
      clearTimeout(pickHeightTimer);
      pickHeightTimer = null;
      pickersEl.style.transition = '';
      pickersEl.style.height = '';
      pickersEl.style.overflow = '';
    }
    mutate();
    const h1 = pickersEl.offsetHeight;
    if (Math.abs(h1 - h0) < 3) return;
    pickersEl.style.transition = 'none';
    pickersEl.style.height = h0 + 'px';
    pickersEl.style.overflow = 'hidden';
    void pickersEl.offsetHeight; // commit the starting height
    pickersEl.style.transition = 'height .26s cubic-bezier(.22,.61,.36,1)';
    pickersEl.style.height = h1 + 'px';
    pickHeightTimer = setTimeout(() => {
      pickHeightTimer = null;
      pickersEl.style.transition = '';
      pickersEl.style.height = '';
      pickersEl.style.overflow = '';
    }, 300);
  }
  function keepScroll(el: HTMLElement, fn: () => void) {
    const saves = [...el.querySelectorAll('.strip, .piano-wrap')].map((s) => s.scrollLeft);
    fn();
    [...el.querySelectorAll('.strip, .piano-wrap')].forEach((s, i) => {
      if (saves[i] !== undefined) s.scrollLeft = saves[i];
    });
  }
  const PARAM_TABS: Record<string, string[]> = {
    voice: ['volume', 'attack', 'decay', 'sustain', 'release'],
    tone: ['cutoff', 'resonance', 'pan', 'glide'],
    eq: ['low', 'mid', 'high'],
    fx: ['reverb', 'delay', 'chorus', 'drive'],
  };
  function renderPickers() {
    animatePickHeight(renderPickersNow);
  }
  function renderPickersNow() {
    const t = active();
    if (!canEdit(t)) {
      pickStatus.innerHTML = readOnly
        ? `the finished carving — <b>${t.name}</b> · listen only`
        : `sealed by another bard — <b>${t.name}</b> · listen only`;
      pickBody.innerHTML = '';
      return;
    }
    // instrument view: the pickers area becomes the parameter altar
    if (state.view === 'inst') {
      const P: any = t.params;
      pickStatus.innerHTML = '';
      const kitRow = t.kind === 'drum' ? `
        <div class="ptabs">${Object.keys(DRUM_KITS).map((k) =>
          `<button data-kit="${k}" class="${(t.drumKit ?? 'Bone Kit') === k ? 'cur' : ''}">${k}</button>`).join('')}</div>` : '';
      // Octave transpose lives at the top of the Voice tab: shift the whole
      // lane down (or up) in whole octaves when notes don't reach low enough.
      const oc = t.octave ?? 0;
      const octRow = state.instTab === 'voice' ? `
        <div class="prow oct-row"><label>octave</label>
          <div class="oct-step">
            <button data-oct="down"${oc <= -4 ? ' disabled' : ''}>−</button>
            <span class="oct-val">${oc > 0 ? '+' : ''}${oc}</span>
            <button data-oct="up"${oc >= 4 ? ' disabled' : ''}>+</button>
          </div>
        </div>` : '';
      pickBody.innerHTML = `
        ${kitRow}
        <div class="ptabs">${Object.keys(PARAM_TABS).map((tab) =>
          `<button data-ptab="${tab}" class="${state.instTab === tab ? 'cur' : ''}">${tab}</button>`).join('')}</div>
        ${octRow}
        ${PARAM_TABS[state.instTab].map((p) => `
          <div class="prow"><label>${p}</label>
            <input type="range" min="0" max="100" value="${Math.round(P[p] * 100)}" data-param="${p}" />
            <output>${Math.round(P[p] * 100)}</output></div>`).join('')}`;
      return;
    }
    const ev = state.sel !== null ? stepAt(t, state.sel) : null;
    const sticky = state.stickyEv[t.key];
    pickStatus.innerHTML = '';
    keepScroll(pickBody, () => {
      // ----- Timing tab content -----
      const beatsRow = `
        <div class="len-row"><span class="lab">Bars</span>${BARS_CHOICES.map((b) =>
          `<button class="nbtn util ${t.barsN === b ? 'sticky' : ''}" data-barsn="${b}">${['I', 'II', 'III'][b - 1]}</button>`).join('')}</div>`;
      const lenRow = `
        <div class="len-row"><span class="lab">Length</span>${[1, 2, 3, 4, 6, 8].map((l) =>
          `<button class="nbtn util ${((ev ?? sticky).len || 1) === l ? 'sticky' : ''}" data-len="${l}">${l === 1 ? '1 step' : '×' + l}</button>`).join('')}</div>`;
      const stepVol = Math.round(((ev ?? sticky).vol ?? 1) * 100);
      const volRow = `
        <div class="len-row"><span class="lab">Step vol</span>
          <input type="range" min="10" max="100" value="${stepVol}" data-vol style="flex:1;accent-color:var(--blood-lit);min-width:0" />
          <output style="width:30px;text-align:right;font-size:11px;color:var(--smoke)">${stepVol}</output></div>`;
      // Lane clock: fractions crawl (one lane step per N master steps),
      // integers race (N lane steps per master step).
      const speedRow = `
        <div class="len-row"><span class="lab">Pace</span>
          <div class="strip" style="padding:0;flex:1;min-width:0">${RING_SPEED_ORDER.map((sp) =>
            `<button class="nbtn util ${(t.speed || '1') === sp ? 'sticky' : ''}" data-speed="${sp}" style="height:30px;min-width:38px">${sp}×</button>`).join('')}
          </div></div>`;

      // ----- Notes tab content: key-dot piano (+ chord quality) -----
      const KW = 44;
      const isChord = t.kind === 'chord';
      const litKey = isChord ? state.chordCfg.root + state.chordCfg.oct : sticky.label;
      const [oLo, oHi] = isChord ? [1, 4] : [2, 5];
      let whites = '', blacks = '', wx = 4;
      for (let o = oLo; o <= oHi; o++) {
        for (let i = 0; i < 12; i++) {
          const name = NOTE_ORDER[i] + o;
          if (!NOTE_ORDER[i].includes('#')) {
            whites += `<div class="pk-w ${name === litKey ? 'sticky' : ''}" style="left:${wx}px" data-note="${name}">${name}</div>`;
            wx += KW;
          } else {
            blacks += `<div class="pk-b ${name === litKey ? 'sticky' : ''}" style="left:${wx - 21}px" data-note="${name}">${name}</div>`;
          }
        }
      }
      const qualRow = isChord ? `
        <div class="strip" data-strip="qual">${CHORD_QUALITIES.map((q) =>
          `<button class="nbtn ${state.chordCfg.qual === q.id ? 'sticky' : ''}" data-qual="${q.id}">${q.label}</button>`).join('')}
          <button class="nbtn util" data-inv="1">${INVERSIONS[state.chordCfg.inv]}</button>
        </div>` : '';
      const notesContent = `
        <div class="piano-wrap"><div class="piano" style="width:${wx + 4}px">${whites}${blacks}</div></div>
        ${qualRow}`;

      // ----- Shape tab content: per-step overrides of the lane's params.
      // Edits land on the selected step (and the sticky, so the next carve
      // inherits them); without a selection they shape the sticky alone.
      const target = ev ?? sticky;
      const so = target.octave ?? 0;
      const hasShape = !!((target.params && Object.keys(target.params).length > 0) || so !== 0);
      // per-step octave stepper, top of the Shape → voice group (offset added
      // on top of the lane octave for just this step)
      const stepOctRow = state.stepTab === 'voice' ? `
        <div class="prow oct-row"><label${so !== 0 ? ' style="color:var(--blood-lit)"' : ''}>octave</label>
          <div class="oct-step">
            <button data-soct="down"${so <= -4 ? ' disabled' : ''}>−</button>
            <span class="oct-val">${so > 0 ? '+' : ''}${so}</span>
            <button data-soct="up"${so >= 4 ? ' disabled' : ''}>+</button>
          </div>
        </div>` : '';
      const shapeContent = `
        <div class="ptabs">${Object.keys(PARAM_TABS).map((tab) =>
          `<button data-stab="${tab}" class="${state.stepTab === tab ? 'cur' : ''}">${tab}</button>`).join('')}</div>
        ${stepOctRow}
        ${PARAM_TABS[state.stepTab].map((p) => {
          const ov = target.params && (target.params as any)[p] !== undefined;
          const val = ov ? (target.params as any)[p] : (t.params as any)[p];
          return `<div class="prow"><label${ov ? ' style="color:var(--blood-lit)"' : ''}>${p}</label>
            <input type="range" min="0" max="100" value="${Math.round(val * 100)}" data-sparam="${p}" />
            <output>${Math.round(val * 100)}</output></div>`;
        }).join('')}
        ${hasShape ? '<div class="len-row"><button class="nbtn util" data-sreset="1">✕ clear step shaping</button></div>' : ''}`;

      const tabBar = `<div class="ptabs pick-tabs">
        <button data-picktab="notes" class="${state.pickTab === 'notes' ? 'cur' : ''}">${isChord ? 'chord' : 'notes'}</button>
        <button data-picktab="timing" class="${state.pickTab === 'timing' ? 'cur' : ''}">timing</button>
        <button data-picktab="shape" class="${state.pickTab === 'shape' ? 'cur' : ''}">shape</button>
      </div>`;
      pickBody.innerHTML = tabBar + (state.pickTab === 'notes'
        ? notesContent
        : state.pickTab === 'timing'
          ? `${lenRow}${volRow}${beatsRow}${speedRow}`
          : shapeContent);

      if (state.pickTab === 'notes' && pianoScrolledFor !== t.key) {
        pianoScrolledFor = t.key;
        const wrap = pickBody.querySelector('.piano-wrap') as HTMLElement | null;
        const kEl = wrap?.querySelector('.pk-w.sticky, .pk-b.sticky') as HTMLElement | null;
        if (wrap && kEl) wrap.scrollLeft = Math.max(0, kEl.offsetLeft - wrap.clientWidth / 2);
      }
    });
  }
  function applySticky() {
    const t = active();
    if (t.kind === 'chord') {
      const prev = state.stickyEv[t.key];
      state.stickyEv[t.key] = buildChord(state.chordCfg, prev.len || 4);
      state.stickyEv[t.key].vol = prev.vol ?? 1;
      if (prev.params) state.stickyEv[t.key].params = clone(prev.params);
      if (prev.octave) state.stickyEv[t.key].octave = prev.octave;
    }
    const ev = clone(state.stickyEv[t.key]);
    if (state.sel !== null && stepAt(t, state.sel)) {
      t.steps[String(state.sel)] = ev;
      commit();
    }
    playEvent(t, ev);
    renderRing();
    renderPickers();
  }
  const onPickClick = (e: Event) => {
    const t = active();
    if (!canEdit(t)) return;
    const target = e.target as HTMLElement;
    const picktab = target.closest('[data-picktab]') as HTMLElement | null;
    if (picktab) {
      state.pickTab = picktab.dataset.picktab;
      if (state.pickTab === 'notes') pianoScrolledFor = null; // re-center the piano
      renderPickers(); return;
    }
    const ptab = target.closest('[data-ptab]') as HTMLElement | null;
    if (ptab) { state.instTab = ptab.dataset.ptab; renderPickers(); return; }
    const octb = target.closest('[data-oct]') as HTMLElement | null;
    if (octb) {
      const dir = octb.dataset.oct === 'up' ? 1 : -1;
      const next = Math.max(-4, Math.min(4, (t.octave ?? 0) + dir));
      if (next !== t.octave) {
        t.octave = next;
        commit();
        playEvent(t, state.stickyEv[t.key]);
        renderRing();
        renderPickers();
      }
      return;
    }
    const stab = target.closest('[data-stab]') as HTMLElement | null;
    if (stab) { state.stepTab = stab.dataset.stab; renderPickers(); return; }
    const soct = target.closest('[data-soct]') as HTMLElement | null;
    if (soct) {
      // per-step octave — write on the sticky AND the selected step
      const dir = soct.dataset.soct === 'up' ? 1 : -1;
      const selEv = state.sel !== null ? stepAt(t, state.sel) : null;
      [state.stickyEv[t.key], ...(selEv ? [selEv] : [])].forEach((x) => {
        const nx = Math.max(-4, Math.min(4, (x.octave ?? 0) + dir));
        if (nx === 0) delete x.octave;
        else x.octave = nx;
      });
      if (selEv) commit();
      playEvent(t, selEv ?? state.stickyEv[t.key]);
      renderRing(); renderPickers(); return;
    }
    const sreset = target.closest('[data-sreset]') as HTMLElement | null;
    if (sreset) {
      delete state.stickyEv[t.key].params;
      delete state.stickyEv[t.key].octave;
      const selEv = state.sel !== null ? stepAt(t, state.sel) : null;
      if (selEv) {
        delete selEv.params;
        delete selEv.octave;
        commit();
      }
      playEvent(t, selEv ?? state.stickyEv[t.key]);
      renderPickers(); return;
    }
    const kit = target.closest('[data-kit]') as HTMLElement | null;
    if (kit && t.kind === 'drum') {
      t.drumKit = kit.dataset.kit!;
      if (!DRUM_KITS[t.drumKit].includes(t.preset)) t.preset = DRUM_KITS[t.drumKit][0];
      commit();
      playEvent(t, state.stickyEv[t.key]);
      renderRing(); renderPickers(); return;
    }
    const spd = target.closest('[data-speed]') as HTMLElement | null;
    if (spd) {
      t.speed = spd.dataset.speed!;
      commit();
      renderRing(); renderPickers(); return;
    }
    const barsn = target.closest('[data-barsn]') as HTMLElement | null;
    if (barsn) {
      // change how many bars this channel's loop spans
      t.barsN = +barsn.dataset.barsn!;
      state.cursor = state.cursor % trackSteps(t);
      state.focusedBar = Math.min(state.focusedBar, t.barsN - 1);
      if (state.sel !== null && state.sel >= trackSteps(t)) state.sel = null;
      commit();
      settle(); renderPickers(); return;
    }
    const note = target.closest('[data-note]') as HTMLElement | null;
    if (note) {
      if (t.kind === 'chord') {
        // piano key = chord root AND octave in one tap
        const p = parseN(note.dataset.note!);
        state.chordCfg.root = NOTE_ORDER[p.semi];
        state.chordCfg.oct = p.oct;
      } else {
        const len = state.stickyEv[t.key].len || 1;
        state.stickyEv[t.key] = N(note.dataset.note!, len);
      }
      applySticky(); return;
    }
    const qual = target.closest('[data-qual]') as HTMLElement | null;
    if (qual) { state.chordCfg.qual = qual.dataset.qual; applySticky(); return; }
    const inv = target.closest('[data-inv]') as HTMLElement | null;
    if (inv) { state.chordCfg.inv = (state.chordCfg.inv + 1) % INVERSIONS.length; applySticky(); return; }
    const len = target.closest('[data-len]') as HTMLElement | null;
    if (len) { state.stickyEv[t.key].len = +len.dataset.len!; applySticky(); return; }
  };
  const onPickInput = (e: Event) => {
    const t = active();
    if (!canEdit(t)) return;
    const target = e.target as HTMLInputElement;
    const vr = target.closest('[data-vol]') as HTMLInputElement | null;
    if (vr) {
      const v = +vr.value / 100;
      state.stickyEv[t.key].vol = v;
      if (state.sel !== null && stepAt(t, state.sel)) {
        stepAt(t, state.sel)!.vol = v;
      }
      (vr.nextElementSibling as HTMLElement).textContent = vr.value;
      renderRing();
      return;
    }
    const sp = target.closest('[data-sparam]') as HTMLInputElement | null;
    if (sp) {
      // step shaping: write the override on the sticky AND the selected step
      const p = sp.dataset.sparam!;
      const v = +sp.value / 100;
      const targets: RingEvent[] = [state.stickyEv[t.key]];
      const selEv = state.sel !== null ? stepAt(t, state.sel) : null;
      if (selEv) targets.push(selEv);
      targets.forEach((x) => {
        x.params = x.params ?? {};
        (x.params as any)[p] = v;
      });
      (sp.nextElementSibling as HTMLElement).textContent = sp.value;
      return;
    }
    const r = target.closest('[data-param]') as HTMLInputElement | null;
    if (!r) return;
    (t.params as any)[r.dataset.param!] = +r.value / 100;
    (r.nextElementSibling as HTMLElement).textContent = r.value;
    if (state.view === 'inst') renderRing(); // arcs mirror reverb/drive
  };
  const onPickChange = (e: Event) => {
    const t = active();
    if (!canEdit(t)) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-param]') || target.closest('[data-vol]') || target.closest('[data-sparam]')) {
      commit(); // sliders write persistent state; save once per release
      const selEv = state.sel !== null ? stepAt(t, state.sel) : null;
      playEvent(t, selEv ?? state.stickyEv[t.key]);
      renderPickers();
    }
  };
  pickBody.addEventListener('click', onPickClick);
  pickBody.addEventListener('input', onPickInput);
  pickBody.addEventListener('change', onPickChange);

  // ================= ring interaction =================
  let dragY: number | null = null, dragged = false, dragStartCursor = 0;
  let arcDrag: { key: string; a0: number; a1: number } | null = null;
  let arcDragged = false;
  const onSvgPointerDown = (e: PointerEvent) => {
    const arc = (e.target as HTMLElement).closest('[data-arc]') as HTMLElement | null;
    if (arc && canEdit(active())) {
      arcDrag = { key: arc.dataset.arc!, a0: +arc.dataset.a0!, a1: +arc.dataset.a1! };
      arcDragged = true;
      try { svg.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
      setArcFromPointer(e);
      return;
    }
    if (state.view !== 'steps') return;
    dragY = e.clientY; dragged = false; dragStartCursor = state.cursor;
  };
  function setArcFromPointer(e: PointerEvent) {
    const rect = svg.getBoundingClientRect();
    const sx = 372 / rect.width;
    const x = (e.clientX - rect.left) * sx - CX;
    const y = (e.clientY - rect.top) * sx - CY;
    let a = (Math.atan2(y, x) * 180) / Math.PI;
    if (a < 0) a += 360;
    const { key, a0, a1 } = arcDrag!;
    (active().params as any)[key] = Math.min(1, Math.max(0, (a - a0) / (a1 - a0)));
    renderRing(); renderPickers();
  }
  const onSvgPointerMove = (e: PointerEvent) => {
    if (arcDrag) { setArcFromPointer(e); return; }
    if (dragY === null) return;
    const dy = e.clientY - dragY;
    if (!dragged && Math.abs(dy) > 10) {
      dragged = true;
      try { svg.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
    }
    if (dragged) {
      const n = trackSteps(active());
      const delta = Math.round(dy / 22);
      state.cursor = ((dragStartCursor + delta) % n + n) % n;
      const bar = Math.floor(state.cursor / 16);
      if (bar !== state.focusedBar && !timer) { state.focusedBar = bar; settle(); }
      renderRing();
    }
  };
  const onWindowPointerUp = () => {
    if (arcDrag && arcDragged) { arcDragged = false; commit(); }
    dragY = null;
    arcDrag = null;
  };
  const onSvgClick = (e: Event) => {
    if (dragged) { dragged = false; return; }
    const target = e.target as HTMLElement;
    if (target.closest('[data-play]')) { togglePlay(); return; }
    const preset = target.closest('[data-preset]') as HTMLElement | null;
    if (preset && canEdit(active())) {
      active().preset = preset.dataset.preset!;
      commit();
      playEvent(active(), state.stickyEv[active().key]);
      renderRing(); renderPickers();
      return;
    }
    const focusRing = target.closest('[data-focus]') as HTMLElement | null;
    if (focusRing) {
      state.focusedBar = +focusRing.dataset.focus!;
      settle();
      return;
    }
    const st = target.closest('[data-s]') as HTMLElement | null;
    if (!st || state.view !== 'steps') return;
    const s = +st.dataset.s!;
    const bar = Math.floor(s / 16);
    if (bar !== state.focusedBar) { state.focusedBar = bar; settle(); return; }
    const t = active();
    if (!canEdit(t)) {
      // sealed lane: taps preview the carved sound but change nothing
      const ev = stepAt(t, s);
      if (ev) playEvent(t, ev);
      return;
    }
    if (!stepAt(t, s)) {
      if (t.kind === 'chord') {
        const prev = state.stickyEv[t.key];
        state.stickyEv[t.key] = buildChord(state.chordCfg, prev.len || 4);
        state.stickyEv[t.key].vol = prev.vol ?? 1;
        if (prev.params) state.stickyEv[t.key].params = clone(prev.params);
        if (prev.octave) state.stickyEv[t.key].octave = prev.octave;
      }
      t.steps[String(s)] = clone(state.stickyEv[t.key]);
      state.sel = s;
      commit();
      playEvent(t, stepAt(t, s)!);
    } else if (state.sel === s) {
      delete t.steps[String(s)];
      state.sel = null;
      commit();
    } else {
      state.sel = s;
      state.stickyEv[t.key] = clone(stepAt(t, s)!);
      if (t.kind === 'chord' && stepAt(t, s)!.cfg) state.chordCfg = clone(stepAt(t, s)!.cfg!);
      playEvent(t, stepAt(t, s)!);
    }
    renderRing(); renderPickers();
  };
  const onSvgWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (state.view !== 'steps') return;
    const n = trackSteps(active());
    state.cursor = ((state.cursor + (e.deltaY > 0 ? 1 : -1)) % n + n) % n;
    const bar = Math.floor(state.cursor / 16);
    if (bar !== state.focusedBar && !timer) { state.focusedBar = bar; settle(); }
    renderRing();
  };
  svg.addEventListener('pointerdown', onSvgPointerDown);
  svg.addEventListener('pointermove', onSvgPointerMove);
  window.addEventListener('pointerup', onWindowPointerUp);
  svg.addEventListener('click', onSvgClick);
  svg.addEventListener('wheel', onSvgWheel, { passive: false });

  // ================= instrument view =================
  const instBtn = app.querySelector('[data-act="inst"]') as HTMLElement;
  const clearBtn = app.querySelector('[data-act="clear"]') as HTMLElement;
  function openInst() {
    // playback keeps running — tweaking an instrument against the loop is
    // exactly what the wheel is for
    state.view = 'inst'; state.sel = null;
    instBtn.classList.add('lit');
    clearBtn.style.display = 'none'; // reads as a "close" button next to the wheel
    settle(); renderPickers();
  }
  function closeInst() {
    state.view = 'steps';
    instBtn.classList.remove('lit');
    clearBtn.style.display = canEdit(active()) ? '' : 'none';
    settle(); renderPickers();
  }
  instBtn.addEventListener('click', () => {
    if (!canEdit(active())) return;
    if (state.view === 'inst') closeInst();
    else openInst();
  });
  clearBtn.addEventListener('click', () => {
    if (!canEdit(active())) return;
    active().steps = {};
    state.sel = null;
    commit();
    renderRing(); renderPickers();
  });

  // ================= chrome =================
  const chips = app.querySelector('.track-chips') as HTMLElement;
  const LOCK_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  function syncEditChrome() {
    const editable = canEdit(active());
    instBtn.style.display = editable ? '' : 'none';
    clearBtn.style.display = editable && state.view !== 'inst' ? '' : 'none';
  }
  function renderChips() {
    chips.innerHTML = state.tracks.map((t: LiveTrack) => `
      <div class="tchip ${t.key === state.activeKey ? 'active' : ''} ${state.hidden.has(t.key) ? 'hidden-track' : ''}" data-k="${t.key}">
        <i class="sw ${t.pat}"></i><span class="nm">${t.name}</span>
        ${!readOnly && !canEdit(t) ? `<span class="lock">${LOCK_SVG}</span>` : ''}
        <button class="eye" data-eye="${t.key}" title="Mute lane">${state.hidden.has(t.key)
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18M10.5 10.6a2.3 2.3 0 0 0 3 3M7 7.2C4.7 8.6 3 12 3 12s3.5 6 9 6c1.6 0 3-.4 4.2-1M10 6.2C10.6 6.1 11.3 6 12 6c5.5 0 9 6 9 6s-.7 1.3-2 2.7"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.4"/></svg>'}</button>
      </div>`).join('');
    // keep the active chip in view (direct scroll, no smooth-jacking)
    const act = chips.querySelector('.tchip.active') as HTMLElement | null;
    if (act && (act.offsetLeft < chips.scrollLeft || act.offsetLeft + act.offsetWidth > chips.scrollLeft + chips.clientWidth)) {
      chips.scrollLeft = Math.max(0, act.offsetLeft - chips.clientWidth / 2 + act.offsetWidth / 2);
    }
  }
  chips.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const eye = target.closest('[data-eye]') as HTMLElement | null;
    if (eye) {
      // mute toggle — any lane, including the active one
      const k = eye.dataset.eye!;
      if (state.hidden.has(k)) state.hidden.delete(k);
      else state.hidden.add(k);
      renderChips(); renderRing(); return;
    }
    const chip = target.closest('.tchip') as HTMLElement | null;
    if (chip) {
      state.activeKey = chip.dataset.k;
      state.sel = null;
      if (state.view === 'inst') {
        // switching lanes exits the wheel — it belongs to the previous lane
        state.view = 'steps';
        instBtn.classList.remove('lit');
      }
      // fold the wound position into the new channel's loop length
      state.cursor = state.cursor % trackSteps(active());
      state.focusedBar = Math.min(Math.floor(state.cursor / 16), active().barsN - 1);
      syncEditChrome();
      renderChips(); settle(); renderPickers();
    }
  });

  renderChips();
  syncEditChrome();
  settle(true);
  renderPickers();

  return {
    getState: serialize,
    destroy() {
      destroyed = true;
      animId++;
      if (timer) clearInterval(timer);
      timer = null;
      window.removeEventListener('pointerup', onWindowPointerUp);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', resumeAudio);
      window.removeEventListener('pageshow', resumeAudio);
      if (mediaKick) {
        try { mediaKick.pause(); } catch { /* already gone */ }
        mediaKick = null;
      }
      if (AC) {
        try { void AC.close(); } catch { /* already closed */ }
        AC = null;
      }
      container.innerHTML = '';
    },
  };
}
