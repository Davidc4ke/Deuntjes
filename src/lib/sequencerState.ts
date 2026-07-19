// Shape of the sequencer's persisted state. The editor (SequencerEditor)
// is the source of truth — this module mirrors its `snapshotState()` /
// `applySnapshot()` shape so the API can hold the blob without parsing it.
// `data` is treated as opaque JSON on save; only `defaultSequencerState()`
// is used server-side when seeding a fresh song.

export type SequencerState = {
  steps: number;
  bpm: number;
  notes: Array<{
    id: number;
    step: number;
    size: number;
    pitch: string;
    channelId: number;
    volume?: number;
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
    eq?: { low?: number; mid?: number; high?: number };
    fx?: Record<string, Record<string, number>>;
    tone?: { cutoff?: number; resonance?: number; filterEnv?: number; pan?: number; glide?: number };
  }>;
  channels: Array<{
    id: number;
    name: string;
    color: string;
    edge: string;
    presetName: string;
    muted: boolean;
    volume: number;
    adsr: { attack: number; decay: number; sustain: number; release: number };
    eq: { low: number; mid: number; high: number };
    fx: {
      reverb: { wet: number; decay: number };
      delay: { wet: number; time: number; feedback: number };
      chorus: { wet: number; freq: number; depth: number };
      distortion: { wet: number; amount: number };
    };
    tone: { cutoff: number; resonance: number; filterEnv: number; pan: number; glide: number };
  }>;
  activeChannelId: number;
  nextChannelId: number;
  nextId: number;
};

// Songs predating the sequencer rewrite have empty / partial blobs. Fill in
// missing fields from the default so the editor always boots cleanly.
export function normalizeSequencerState(raw: unknown): SequencerState {
  const base = defaultSequencerState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SequencerState>;
  return {
    steps: r.steps ?? base.steps,
    bpm: typeof r.bpm === 'number' && isFinite(r.bpm) ? r.bpm : base.bpm,
    notes: Array.isArray(r.notes) ? r.notes : base.notes,
    channels: Array.isArray(r.channels) && r.channels.length > 0 ? r.channels : base.channels,
    activeChannelId: r.activeChannelId ?? base.activeChannelId,
    nextChannelId: r.nextChannelId ?? base.nextChannelId,
    nextId: r.nextId ?? base.nextId,
  };
}

export function defaultSequencerState(): SequencerState {
  // Mirrors the mockup's initial state object so a freshly-created song
  // opens to the same seed grid the sandbox does.
  const defaultEQ = () => ({ low: 0, mid: 0, high: 0 });
  const defaultFX = () => ({
    reverb: { wet: 0, decay: 1.5 },
    delay: { wet: 0, time: 0.25, feedback: 0.3 },
    chorus: { wet: 0, freq: 1.5, depth: 0.7 },
    distortion: { wet: 0, amount: 0.4 },
  });
  const defaultTone = () => ({ cutoff: 12000, resonance: 1, filterEnv: 3, pan: 0, glide: 0 });
  return {
    steps: 16,
    bpm: 120,
    notes: [],
    channels: [
      { id: 1, name: 'Bass',  color: '#e89e58', edge: '#b87a3a', presetName: 'bass',  muted: false, volume: 0.8, adsr: { attack: 0.02,  decay: 0.15, sustain: 0.7, release: 0.4  }, eq: defaultEQ(), fx: defaultFX(), tone: defaultTone() },
      { id: 2, name: 'Drum',  color: '#6ec3a4', edge: '#3f8a70', presetName: 'pluck', muted: false, volume: 0.8, adsr: { attack: 0.005, decay: 0.05, sustain: 0.0, release: 0.15 }, eq: defaultEQ(), fx: defaultFX(), tone: defaultTone() },
      { id: 3, name: 'Lead',  color: '#7b9ce6', edge: '#4b6db8', presetName: 'lead',  muted: false, volume: 0.8, adsr: { attack: 0.01,  decay: 0.10, sustain: 0.5, release: 0.3  }, eq: defaultEQ(), fx: defaultFX(), tone: defaultTone() },
      { id: 4, name: 'Chord', color: '#c47ccf', edge: '#8a4d93', presetName: 'pad',   muted: false, volume: 0.8, adsr: { attack: 0.10,  decay: 0.20, sustain: 0.8, release: 0.8  }, eq: defaultEQ(), fx: defaultFX(), tone: defaultTone() },
    ],
    activeChannelId: 1,
    nextChannelId: 5,
    nextId: 1,
  };
}
