// Persisted shape of the Ritual Ring sequencer (game-mode editor). The ring
// engine (src/components/ring/ringCore.ts) is the source of truth for how
// this data sounds; this module owns the serializable shape, the default
// dungeon track list, and the vocabulary (presets, kits, chords) that both
// the client engine and the server-side turn validator need.
//
// A song blob with `format: 'ring'` uses this shape; anything else is the
// legacy grid sequencer's SequencerState. Games created from now on seed
// ring-format songs; old games keep working through the legacy editor.

export type ChordCfg = { root: string; qual: string; oct: number; inv: number };

export type RingEvent = {
  label: string;
  notes: string[]; // pitch names like 'C2'; chords carry several
  len: number; // in this channel's own 16th steps
  vol?: number; // step velocity 0..1 (default 1)
  cfg?: ChordCfg; // chord tracks remember the forge settings for re-editing
  // Sparse per-step overrides of the lane's params — only the touched knobs
  // are stored; playback merges them over the lane values for this hit.
  params?: Partial<RingParams>;
};

export type RingParams = {
  volume: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  resonance: number;
  pan: number;
  glide: number;
  low: number;
  mid: number;
  high: number;
  reverb: number;
  delay: number;
  chorus: number;
  drive: number;
};

export type RingTrackKind = 'drum' | 'melodic' | 'chord';

export type RingTrack = {
  key: string;
  name: string;
  kind: RingTrackKind;
  // Which game channel owns this lane (1=Bass, 2=Drum, 3=Lead, 4=Chord).
  // A dealt turn may only touch its own channel's lanes.
  channelId: number;
  preset: string;
  drumKit?: string; // drum lanes only
  barsN: number; // loop length in bars (1..3), independent per lane
  // Clock rate relative to the master step, as a token from RING_SPEEDS:
  // '1/2' advances one lane step per two master steps, '2' advances two lane
  // steps per master step. '1' is lockstep.
  speed: string;
  // Whole-octave transpose for the whole lane (−4..+4). Applied at playback
  // as a frequency multiplier, so it deepens drums too. 0 = as written.
  octave: number;
  steps: Record<string, RingEvent>; // step index -> event
  params: RingParams;
};

export type RingSongState = {
  format: 'ring';
  // Master tempo, set when the dungeon is raised and locked for its life.
  bpm: number;
  tracks: RingTrack[];
};

export const RING_PARAM_KEYS: Array<keyof RingParams> = [
  'volume', 'attack', 'decay', 'sustain', 'release',
  'cutoff', 'resonance', 'pan', 'glide',
  'low', 'mid', 'high',
  'reverb', 'delay', 'chorus', 'drive',
];

export function defaultRingParams(): RingParams {
  return {
    volume: 0.8,
    attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.3,
    cutoff: 0.8, resonance: 0.1, pan: 0.5, glide: 0,
    low: 0.5, mid: 0.5, high: 0.5,
    // all sends dry by default — space is a choice, not a preset
    reverb: 0, delay: 0, chorus: 0, drive: 0,
  };
}

// ---------------------------------------------------------------------------
// vocabulary
// ---------------------------------------------------------------------------

export const RING_NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const RING_DRUM_KITS: Record<string, string[]> = {
  'Bone Kit': ['Kick', '808', 'Snare', 'Clap', 'Hat', 'Open Hat', 'Tom', 'Perc', 'Rim', 'Crash', 'Ride'],
  'Neon 808': ['808 Kick', '808 Snare', '808 Clap', '808 Hat', '808 Open', '808 Tom', 'Cowbell', 'Rimshot', 'Maracas'],
  'Grave 909': ['909 Kick', '909 Snare', '909 Clap', '909 Hat', '909 Open', '909 Ride', '909 Crash', 'Zap'],
  'Ritual Hand': ['Djembe', 'Conga', 'Bongo', 'Taiko', 'Clave', 'Block', 'Shaker', 'Tambo'],
};

export const RING_MELODIC_PRESETS = ['Bass', 'Sub', 'Acid', 'Reese', 'Lead', 'Pluck', 'Bell', 'Marimba', 'Keys'];
export const RING_CHORD_PRESETS = ['Pad', 'Keys', 'Organ', 'Strings', 'Choir', 'Bell'];

// Track-type discipline, same spirit as the legacy CHANNEL_ALLOWED_PRESETS:
// Bass gets low voices, Lead gets melodic voices, Chord gets poly voices.
// Drum lanes are validated against the drum kits instead.
export const RING_CHANNEL_PRESETS: Record<number, string[]> = {
  1: ['Bass', 'Sub', 'Acid', 'Reese'],
  3: ['Lead', 'Pluck', 'Acid', 'Bell', 'Marimba', 'Keys'],
  4: RING_CHORD_PRESETS,
};

export const RING_CHORD_QUALITY_IDS = [
  'maj', 'min', '7', 'maj7', 'm7', '6', 'm6', 'sus2', 'sus4', 'dim',
  'dim7', 'm7b5', 'aug', '5', 'add9', '9', 'maj9', 'm9', '11', '13',
];

export const RING_BARS_CHOICES = [1, 2, 3];
export const RING_MAX_STEPS = 16 * 3;
export const RING_OCTAVE_MIN = -4;
export const RING_OCTAVE_MAX = 4;

// Lane clock rates: lane steps advanced per master step. Fractions are slow
// lanes (one step every N master steps), integers are fast lanes. Every value
// divides the 24-subtick master step evenly, so the transport stays exact.
export const RING_SPEEDS: Record<string, { num: number; den: number }> = {
  '1/8': { num: 1, den: 8 },
  '1/6': { num: 1, den: 6 },
  '1/4': { num: 1, den: 4 },
  '1/3': { num: 1, den: 3 },
  '1/2': { num: 1, den: 2 },
  '1': { num: 1, den: 1 },
  '2': { num: 2, den: 1 },
  '3': { num: 3, den: 1 },
  '4': { num: 4, den: 1 },
};
export const RING_SPEED_ORDER = ['1/8', '1/6', '1/4', '1/3', '1/2', '1', '2', '3', '4'];

export const RING_BPM_MIN = 40;
export const RING_BPM_MAX = 220;
export const RING_BPM_DEFAULT = 120;

export function clampRingBpm(raw: unknown): number {
  const n = typeof raw === 'number' && isFinite(raw) ? Math.round(raw) : RING_BPM_DEFAULT;
  return Math.min(RING_BPM_MAX, Math.max(RING_BPM_MIN, n));
}

// ---------------------------------------------------------------------------
// defaults
// ---------------------------------------------------------------------------

type LaneSeed = {
  key: string;
  name: string;
  kind: RingTrackKind;
  channelId: number;
  preset: string;
  drumKit?: string;
};

// Each game channel owns a small group of lanes, so the Drum bard can build
// a whole beat (kick/snare/hats/perc) and the melodic bards get a main lane
// plus a support lane.
const LANE_SEEDS: LaneSeed[] = [
  // Neon 808 is the house kit — new dungeons start there; Bone Kit and the
  // rest stay one tap away in the forge.
  { key: 'kick',  name: 'Kick',  kind: 'drum',    channelId: 2, preset: '808 Kick',  drumKit: 'Neon 808' },
  { key: 'snare', name: 'Snare', kind: 'drum',    channelId: 2, preset: '808 Snare', drumKit: 'Neon 808' },
  { key: 'hats',  name: 'Hats',  kind: 'drum',    channelId: 2, preset: '808 Hat',   drumKit: 'Neon 808' },
  { key: 'perc',  name: 'Perc',  kind: 'drum',    channelId: 2, preset: '808 Tom',   drumKit: 'Neon 808' },
  { key: 'bass',  name: 'Bass',  kind: 'melodic', channelId: 1, preset: 'Bass' },
  { key: 'sub',   name: 'Sub',   kind: 'melodic', channelId: 1, preset: 'Sub' },
  { key: 'lead',  name: 'Lead',  kind: 'melodic', channelId: 3, preset: 'Lead' },
  { key: 'arp',   name: 'Arp',   kind: 'melodic', channelId: 3, preset: 'Pluck' },
  { key: 'chord', name: 'Chord', kind: 'chord',   channelId: 4, preset: 'Pad' },
  { key: 'pads',  name: 'Pads',  kind: 'chord',   channelId: 4, preset: 'Strings' },
];

export function defaultRingSongState(bpm: number = RING_BPM_DEFAULT): RingSongState {
  return {
    format: 'ring',
    bpm: clampRingBpm(bpm),
    tracks: LANE_SEEDS.map((seed) => ({
      ...seed,
      barsN: seed.kind === 'drum' ? 1 : 2,
      speed: '1',
      octave: 0,
      steps: {},
      params: defaultRingParams(),
    })),
  };
}

export function isRingState(raw: unknown): raw is RingSongState {
  return (
    !!raw &&
    typeof raw === 'object' &&
    (raw as { format?: unknown }).format === 'ring' &&
    Array.isArray((raw as { tracks?: unknown }).tracks)
  );
}

// ---------------------------------------------------------------------------
// sanitization — shared by normalize (page load) and the turn validator.
// Rebuilds a track from whitelisted fields only, so junk can't ride into the
// blob, and clamps everything to legal ranges.
// ---------------------------------------------------------------------------

const NOTE_RE = /^[A-G]#?[0-8]$/;

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof v === 'number' && isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
}

export function sanitizeRingParams(raw: unknown): RingParams {
  const base = defaultRingParams();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const out = { ...base };
  for (const k of RING_PARAM_KEYS) out[k] = num(r[k], base[k], 0, 1);
  return out;
}

export function sanitizeRingEvent(raw: unknown, kind: RingTrackKind): RingEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const notesRaw = Array.isArray(r.notes) ? r.notes : [];
  const notes = notesRaw.filter((n): n is string => typeof n === 'string' && NOTE_RE.test(n)).slice(0, 8);
  if (notes.length === 0) return null;
  const label = typeof r.label === 'string' && r.label.length > 0 ? r.label.slice(0, 16) : notes[0];
  const ev: RingEvent = {
    label,
    notes,
    len: Math.round(num(r.len, 1, 1, 16)),
    vol: num(r.vol, 1, 0.05, 1),
  };
  if (kind === 'chord' && r.cfg && typeof r.cfg === 'object') {
    const c = r.cfg as Record<string, unknown>;
    const root = typeof c.root === 'string' && RING_NOTE_ORDER.includes(c.root) ? c.root : 'C';
    const qual = typeof c.qual === 'string' && RING_CHORD_QUALITY_IDS.includes(c.qual) ? c.qual : 'maj';
    ev.cfg = { root, qual, oct: Math.round(num(c.oct, 3, 0, 8)), inv: Math.round(num(c.inv, 0, 0, 2)) };
  }
  if (r.params && typeof r.params === 'object') {
    const src = r.params as Record<string, unknown>;
    const p: Partial<RingParams> = {};
    for (const k of RING_PARAM_KEYS) {
      const v = src[k];
      if (typeof v === 'number' && isFinite(v)) p[k] = Math.min(1, Math.max(0, v));
    }
    if (Object.keys(p).length > 0) ev.params = p;
  }
  return ev;
}

// Sanitize one track against its immutable identity (from the stored lane).
// Identity fields (key/name/kind/channelId) always come from the seed; only
// the musical payload is taken from the input.
export function sanitizeRingTrack(identity: LaneSeed, raw: unknown): RingTrack {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  let drumKit: string | undefined;
  let preset: string;
  if (identity.kind === 'drum') {
    drumKit = typeof r.drumKit === 'string' && RING_DRUM_KITS[r.drumKit] ? r.drumKit : (identity.drumKit ?? 'Bone Kit');
    const kitVoices = RING_DRUM_KITS[drumKit];
    preset = typeof r.preset === 'string' && kitVoices.includes(r.preset) ? r.preset : kitVoices[0];
  } else {
    const allowed = RING_CHANNEL_PRESETS[identity.channelId] ?? (identity.kind === 'chord' ? RING_CHORD_PRESETS : RING_MELODIC_PRESETS);
    preset = typeof r.preset === 'string' && allowed.includes(r.preset) ? r.preset : identity.preset;
  }

  const barsRaw = Math.round(num(r.barsN, identity.kind === 'drum' ? 1 : 2, 1, 3));
  const barsN = RING_BARS_CHOICES.includes(barsRaw) ? barsRaw : 2;
  const speed = typeof r.speed === 'string' && RING_SPEEDS[r.speed] ? r.speed : '1';
  const octave = Math.round(num(r.octave, 0, RING_OCTAVE_MIN, RING_OCTAVE_MAX));

  const steps: Record<string, RingEvent> = {};
  if (r.steps && typeof r.steps === 'object') {
    for (const [k, v] of Object.entries(r.steps as Record<string, unknown>)) {
      const idx = Number(k);
      if (!Number.isInteger(idx) || idx < 0 || idx >= RING_MAX_STEPS) continue;
      const ev = sanitizeRingEvent(v, identity.kind);
      if (ev) steps[String(idx)] = ev;
    }
  }

  return {
    key: identity.key,
    name: identity.name,
    kind: identity.kind,
    channelId: identity.channelId,
    preset,
    ...(drumKit ? { drumKit } : {}),
    barsN,
    speed,
    octave,
    steps,
    params: sanitizeRingParams(r.params),
  };
}

// Normalize an arbitrary blob into a well-formed RingSongState. Tracks are
// matched to the canonical lane list by key; missing lanes are seeded empty,
// unknown lanes are dropped. This keeps the lane list a closed set, which is
// what the turn validator's channel-ownership rule depends on.
export function normalizeRingState(raw: unknown): RingSongState {
  const byKey = new Map<string, unknown>();
  if (isRingState(raw)) {
    for (const t of raw.tracks as unknown[]) {
      if (t && typeof t === 'object' && typeof (t as { key?: unknown }).key === 'string') {
        byKey.set((t as { key: string }).key, t);
      }
    }
  }
  return {
    format: 'ring',
    bpm: clampRingBpm(isRingState(raw) ? (raw as { bpm?: unknown }).bpm : undefined),
    tracks: LANE_SEEDS.map((seed) => sanitizeRingTrack(seed, byKey.get(seed.key))),
  };
}
