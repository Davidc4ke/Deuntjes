import type { NoteEvent } from '@/lib/midiBars';
import { ticksPerBar, OUTPUT_PPQ } from '@/lib/midiBars';

export type TrackerNote = {
  step: number;
  pitch: number;
  velocity: number;
  length_steps: number;
};

export type TrackerPayload = {
  version: 1;
  granularity: 4 | 8 | 16 | 32;
  notes: TrackerNote[];
};

export const VALID_GRANULARITIES = [4, 8, 16, 32] as const;

export function isGranularity(n: unknown): n is 4 | 8 | 16 | 32 {
  return n === 4 || n === 8 || n === 16 || n === 32;
}

/**
 * Steps per bar at a given granularity. A 16th-note granularity in 4/4 = 16
 * steps/bar; in 3/4 = 12 steps/bar. (granularity is "Nth notes per whole
 * note", scaled by the bar's quarter-note count.)
 */
export function stepsPerBar(granularity: number, timeSigNum: number, timeSigDen: number): number {
  // Quarter notes per bar = (num * 4 / den)
  const quartersPerBar = (timeSigNum * 4) / timeSigDen;
  // Steps per quarter at granularity G = G / 4
  return Math.round((granularity / 4) * quartersPerBar);
}

const TRACKER_PAYLOAD_VERSION = 1;

export function validateTrackerPayload(
  input: unknown,
  ctx: {
    timeSigNum: number;
    timeSigDen: number;
    totalBars: number;
  },
): { ok: true; payload: TrackerPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'payload required' };
  const p = input as Record<string, unknown>;
  if (p.version !== TRACKER_PAYLOAD_VERSION) {
    return { ok: false, error: 'unsupported payload version' };
  }
  if (!isGranularity(p.granularity)) {
    return { ok: false, error: 'granularity must be 4|8|16|32' };
  }
  if (!Array.isArray(p.notes)) return { ok: false, error: 'notes must be an array' };

  const totalSteps = stepsPerBar(p.granularity, ctx.timeSigNum, ctx.timeSigDen) * ctx.totalBars;
  const notes: TrackerNote[] = [];
  for (const raw of p.notes) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid note' };
    const n = raw as Record<string, unknown>;
    const step = Number(n.step);
    const pitch = Number(n.pitch);
    const velocity = Number(n.velocity);
    const length_steps = Number(n.length_steps);
    if (!Number.isInteger(step) || step < 0 || step >= totalSteps) {
      return { ok: false, error: `step ${step} out of range` };
    }
    if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
      return { ok: false, error: `pitch ${pitch} out of range` };
    }
    if (!Number.isFinite(velocity) || velocity < 1 || velocity > 127) {
      return { ok: false, error: `velocity ${velocity} out of range` };
    }
    if (!Number.isInteger(length_steps) || length_steps < 1) {
      return { ok: false, error: 'length_steps must be >= 1' };
    }
    notes.push({ step, pitch, velocity: Math.round(velocity), length_steps });
  }

  return {
    ok: true,
    payload: { version: 1, granularity: p.granularity, notes },
  };
}

/**
 * Convert a tracker payload to MIDI note events at OUTPUT_PPQ. Steps are
 * positioned at fixed tick intervals derived from granularity.
 */
export function renderTrackerPayload(
  payload: TrackerPayload,
  timeSigNum: number,
  timeSigDen: number,
): NoteEvent[] {
  const tpb = ticksPerBar(timeSigNum, timeSigDen, OUTPUT_PPQ);
  const spb = stepsPerBar(payload.granularity, timeSigNum, timeSigDen);
  const ticksPerStep = Math.round(tpb / spb);
  const out: NoteEvent[] = [];
  for (const n of payload.notes) {
    out.push({
      midi: n.pitch,
      ticks: n.step * ticksPerStep,
      durationTicks: Math.max(1, n.length_steps * ticksPerStep),
      velocity: Math.max(0.05, Math.min(1, n.velocity / 127)),
    });
  }
  return out;
}
