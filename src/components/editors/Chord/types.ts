import type { ChordEntry, ChordPayload } from '@/lib/render/chordTake';

export type { ChordEntry, ChordPayload };

export type BarChord = {
  root: string;
  quality: string;
};

/**
 * Internal editor representation: an entry per bar (null = "no chord on this
 * bar"). On save we convert to ChordPayload's chords[] flattening empties.
 */
export type BarsState = (BarChord | null)[];
