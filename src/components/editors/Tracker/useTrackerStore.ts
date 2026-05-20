'use client';
import { create } from 'zustand';
import type { Granularity, TrackerNote } from './types';
import { stepsPerBar } from '@/lib/render/trackerTake';

const HISTORY_LIMIT = 40;

type Snapshot = {
  notes: TrackerNote[];
  granularity: Granularity;
};

export type TrackerEditorState = Snapshot & {
  selectedStep: number | null;

  currentPitch: number;
  currentVelocity: number;
  currentLengthSteps: number;

  timeSigNum: number;
  timeSigDen: number;
  totalBars: number;

  history: Snapshot[];

  init: (opts: {
    notes: TrackerNote[];
    granularity: Granularity;
    timeSigNum: number;
    timeSigDen: number;
    totalBars: number;
    defaultPitch?: number;
  }) => void;

  placeAt: (step: number) => void;
  selectAt: (step: number | null) => void;
  deleteSelected: () => void;
  setSelectedLength: (length: number) => void;
  setSelectedVelocity: (velocity: number) => void;

  setCurrentPitch: (pitch: number) => void;
  setCurrentVelocity: (velocity: number) => void;
  setCurrentLengthSteps: (length: number) => void;
  bumpOctave: (delta: number) => void;

  setGranularity: (g: Granularity) => void;

  undo: () => void;
};

function noteAtStep(notes: TrackerNote[], step: number): TrackerNote | null {
  for (const n of notes) if (n.step === step) return n;
  return null;
}

function pushHistory(history: Snapshot[], entry: Snapshot): Snapshot[] {
  const next = history.concat([entry]);
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

export const useTrackerStore = create<TrackerEditorState>((set, get) => ({
  notes: [],
  granularity: 16,
  selectedStep: null,
  currentPitch: 60,
  currentVelocity: 100,
  currentLengthSteps: 1,
  timeSigNum: 4,
  timeSigDen: 4,
  totalBars: 4,
  history: [],

  init: ({ notes, granularity, timeSigNum, timeSigDen, totalBars, defaultPitch }) =>
    set({
      notes,
      granularity,
      selectedStep: null,
      currentPitch: defaultPitch ?? 60,
      currentVelocity: 100,
      currentLengthSteps: 1,
      timeSigNum,
      timeSigDen,
      totalBars,
      history: [],
    }),

  placeAt: (step) => {
    const s = get();
    const totalSteps = stepsPerBar(s.granularity, s.timeSigNum, s.timeSigDen) * s.totalBars;
    if (step < 0 || step >= totalSteps) return;
    const existing = noteAtStep(s.notes, step);
    const nextLength = Math.min(s.currentLengthSteps, totalSteps - step);
    const newNote: TrackerNote = {
      step,
      pitch: s.currentPitch,
      velocity: s.currentVelocity,
      length_steps: Math.max(1, nextLength),
    };
    const next = existing
      ? s.notes.map((n) => (n.step === step ? newNote : n))
      : s.notes.concat([newNote]);
    set({
      notes: next,
      selectedStep: step,
      history: pushHistory(s.history, { notes: s.notes, granularity: s.granularity }),
    });
  },

  selectAt: (step) => set({ selectedStep: step }),

  deleteSelected: () => {
    const s = get();
    if (s.selectedStep == null) return;
    const target = s.selectedStep;
    if (!noteAtStep(s.notes, target)) {
      set({ selectedStep: null });
      return;
    }
    set({
      notes: s.notes.filter((n) => n.step !== target),
      selectedStep: null,
      history: pushHistory(s.history, { notes: s.notes, granularity: s.granularity }),
    });
  },

  setSelectedLength: (length) => {
    const s = get();
    if (s.selectedStep == null) return;
    const totalSteps = stepsPerBar(s.granularity, s.timeSigNum, s.timeSigDen) * s.totalBars;
    const target = s.selectedStep;
    const note = noteAtStep(s.notes, target);
    if (!note) return;
    const cap = totalSteps - target;
    const newLen = Math.max(1, Math.min(cap, Math.round(length)));
    if (newLen === note.length_steps) return;
    set({
      notes: s.notes.map((n) => (n.step === target ? { ...n, length_steps: newLen } : n)),
      history: pushHistory(s.history, { notes: s.notes, granularity: s.granularity }),
    });
  },

  setSelectedVelocity: (velocity) => {
    const s = get();
    if (s.selectedStep == null) return;
    const target = s.selectedStep;
    const note = noteAtStep(s.notes, target);
    if (!note) return;
    const v = Math.max(1, Math.min(127, Math.round(velocity)));
    if (v === note.velocity) return;
    set({
      notes: s.notes.map((n) => (n.step === target ? { ...n, velocity: v } : n)),
      history: pushHistory(s.history, { notes: s.notes, granularity: s.granularity }),
    });
  },

  setCurrentPitch: (pitch) => set({ currentPitch: Math.max(0, Math.min(127, Math.round(pitch))) }),
  setCurrentVelocity: (velocity) =>
    set({ currentVelocity: Math.max(1, Math.min(127, Math.round(velocity))) }),
  setCurrentLengthSteps: (length) =>
    set({ currentLengthSteps: Math.max(1, Math.min(32, Math.round(length))) }),
  bumpOctave: (delta) => {
    const s = get();
    const next = s.currentPitch + delta * 12;
    if (next < 0 || next > 127) return;
    set({ currentPitch: next });
  },

  setGranularity: (g) => {
    const s = get();
    if (g === s.granularity) return;
    const oldSpb = stepsPerBar(s.granularity, s.timeSigNum, s.timeSigDen);
    const newSpb = stepsPerBar(g, s.timeSigNum, s.timeSigDen);
    const totalNewSteps = newSpb * s.totalBars;
    const ratio = newSpb / oldSpb;
    // Re-quantize: scale step and length, then clamp to [1, totalSteps - step].
    // If two notes collide after rescaling, the later one wins (Map semantics).
    const byStep = new Map<number, TrackerNote>();
    for (const n of s.notes) {
      const newStep = Math.max(0, Math.min(totalNewSteps - 1, Math.round(n.step * ratio)));
      const newLen = Math.max(1, Math.min(totalNewSteps - newStep, Math.round(n.length_steps * ratio)));
      byStep.set(newStep, { step: newStep, pitch: n.pitch, velocity: n.velocity, length_steps: newLen });
    }
    set({
      granularity: g,
      notes: Array.from(byStep.values()).sort((a, b) => a.step - b.step),
      selectedStep: null,
      currentLengthSteps: Math.max(1, Math.round(s.currentLengthSteps * ratio)),
      history: pushHistory(s.history, { notes: s.notes, granularity: s.granularity }),
    });
  },

  undo: () => {
    const s = get();
    if (s.history.length === 0) return;
    const prev = s.history[s.history.length - 1];
    set({
      notes: prev.notes,
      granularity: prev.granularity,
      selectedStep: null,
      history: s.history.slice(0, -1),
    });
  },
}));
