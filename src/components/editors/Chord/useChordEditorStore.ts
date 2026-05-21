'use client';
import { create } from 'zustand';
import type { BarChord, BarsState } from './types';

const HISTORY_LIMIT = 30;

export type ChordEditorState = {
  bars: BarsState;
  voicingOctave: number;
  history: { bars: BarsState; voicingOctave: number }[];

  init: (bars: BarsState, voicingOctave: number) => void;
  setChord: (barIdx: number, chord: BarChord) => void;
  clearChord: (barIdx: number) => void;
  setVoicingOctave: (octave: number) => void;
  undo: () => void;
};

export const useChordEditorStore = create<ChordEditorState>((set, get) => ({
  bars: [],
  voicingOctave: 4,
  history: [],

  init: (bars, voicingOctave) =>
    set({ bars, voicingOctave, history: [] }),

  setChord: (barIdx, chord) => {
    const { bars, voicingOctave, history } = get();
    if (barIdx < 0 || barIdx >= bars.length) return;
    const next = bars.slice();
    next[barIdx] = chord;
    set({
      bars: next,
      history: pushHistory(history, { bars, voicingOctave }),
    });
  },

  clearChord: (barIdx) => {
    const { bars, voicingOctave, history } = get();
    if (barIdx < 0 || barIdx >= bars.length || bars[barIdx] === null) return;
    const next = bars.slice();
    next[barIdx] = null;
    set({
      bars: next,
      history: pushHistory(history, { bars, voicingOctave }),
    });
  },

  setVoicingOctave: (octave) => {
    const { bars, voicingOctave, history } = get();
    const clamped = Math.max(1, Math.min(7, Math.round(octave)));
    if (clamped === voicingOctave) return;
    set({
      voicingOctave: clamped,
      history: pushHistory(history, { bars, voicingOctave }),
    });
  },

  undo: () => {
    const { history } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      bars: prev.bars,
      voicingOctave: prev.voicingOctave,
      history: history.slice(0, -1),
    });
  },
}));

function pushHistory<T>(history: T[], entry: T): T[] {
  const next = history.concat([entry]);
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}
