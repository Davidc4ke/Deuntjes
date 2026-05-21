import { Chord, Note } from 'tonal';
import type { NoteEvent } from '@/lib/midiBars';
import { ticksPerBar, OUTPUT_PPQ } from '@/lib/midiBars';

export type ChordEntry = {
  start_bar: number;
  length_beats: number;
  root: string;
  quality: string;
};

export type ChordPayload = {
  version: 1;
  voicing_octave: number;
  chords: ChordEntry[];
};

export function chordName(root: string, quality: string): string {
  return quality ? `${root}${quality}` : root;
}

export function chordToMidiNotes(root: string, quality: string, voicingOctave: number): number[] {
  const name = chordName(root, quality);
  const c = Chord.get(name);
  if (c.empty || !c.intervals.length) return [];
  const out: number[] = [];
  const rootWithOct = `${root}${voicingOctave}`;
  let prev = -1;
  for (const iv of c.intervals) {
    const noteName = Note.transpose(rootWithOct, iv);
    const m = Note.midi(noteName);
    if (m == null) continue;
    // Tonal already places intervals relative to the root note, so the
    // sequence is monotonic. Skip duplicates defensively.
    if (m <= prev) continue;
    out.push(m);
    prev = m;
  }
  return out;
}

const NUM_CHORD_PAYLOAD_VERSION = 1;

export function validateChordPayload(input: unknown, ctx: {
  timeSigNum: number;
  timeSigDen: number;
  totalBars: number;
}): { ok: true; payload: ChordPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'payload required' };
  const p = input as Record<string, unknown>;
  if (p.version !== NUM_CHORD_PAYLOAD_VERSION) {
    return { ok: false, error: 'unsupported payload version' };
  }
  const voicingOctave = Number(p.voicing_octave);
  if (!Number.isFinite(voicingOctave) || voicingOctave < 1 || voicingOctave > 7) {
    return { ok: false, error: 'voicing_octave must be 1-7' };
  }
  if (!Array.isArray(p.chords)) return { ok: false, error: 'chords must be an array' };

  const totalBeats = ctx.totalBars * ctx.timeSigNum;
  const chords: ChordEntry[] = [];
  for (const raw of p.chords) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid chord entry' };
    const c = raw as Record<string, unknown>;
    const start_bar = Number(c.start_bar);
    const length_beats = Number(c.length_beats);
    const root = String(c.root ?? '').trim();
    const quality = String(c.quality ?? '').trim();
    if (!Number.isInteger(start_bar) || start_bar < 0 || start_bar >= ctx.totalBars) {
      return { ok: false, error: `start_bar ${start_bar} out of range` };
    }
    if (!Number.isFinite(length_beats) || length_beats <= 0) {
      return { ok: false, error: 'length_beats must be > 0' };
    }
    if (!root) return { ok: false, error: 'chord root required' };
    const startBeat = start_bar * ctx.timeSigNum;
    if (startBeat + length_beats > totalBeats + 1e-6) {
      return { ok: false, error: 'chord extends past end' };
    }
    // Validate chord resolves to something real.
    if (chordToMidiNotes(root, quality, 4).length === 0) {
      return { ok: false, error: `unknown chord "${chordName(root, quality)}"` };
    }
    chords.push({ start_bar, length_beats, root, quality });
  }

  return {
    ok: true,
    payload: { version: 1, voicing_octave: Math.round(voicingOctave), chords },
  };
}

/**
 * Convert a chord payload to a sequence of MIDI note-on events at OUTPUT_PPQ.
 * Each chord is voiced as a block (all notes at the same start tick).
 */
export function renderChordPayload(
  payload: ChordPayload,
  timeSigNum: number,
  timeSigDen: number,
): NoteEvent[] {
  const out: NoteEvent[] = [];
  const tpb = ticksPerBar(timeSigNum, timeSigDen, OUTPUT_PPQ);
  const ticksPerBeat = Math.round(tpb / timeSigNum);
  for (const c of payload.chords) {
    const midis = chordToMidiNotes(c.root, c.quality, payload.voicing_octave);
    if (midis.length === 0) continue;
    const startTicks = c.start_bar * tpb;
    const durTicks = Math.max(1, Math.round(c.length_beats * ticksPerBeat));
    for (const m of midis) {
      out.push({
        midi: m,
        ticks: startTicks,
        durationTicks: durTicks,
        velocity: 0.78,
      });
    }
  }
  return out;
}
