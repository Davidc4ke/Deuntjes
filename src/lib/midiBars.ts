// Bar/tick math shared between server-side export and client-side playback.

export const OUTPUT_PPQ = 480;

export function ticksPerBar(timeSigNum: number, timeSigDen: number, ppq: number = OUTPUT_PPQ) {
  // One bar = (num * 4 / den) quarter notes
  return Math.round((ppq * timeSigNum * 4) / timeSigDen);
}

export type NoteEvent = {
  midi: number;
  ticks: number;
  durationTicks: number;
  velocity: number;
};

/**
 * Take a list of notes (in source ticks at source PPQ) and convert to a
 * target PPQ, clipping to a half-open bar window [windowStartBar, windowEndBar).
 * Returns notes with `ticks` re-anchored so that windowStartBar maps to 0.
 */
export function clipAndRescale(
  notes: NoteEvent[],
  sourcePpq: number,
  timeSigNum: number,
  timeSigDen: number,
  windowStartBar: number,
  windowEndBar: number,
): NoteEvent[] {
  if (windowEndBar <= windowStartBar) return [];
  const sourceTicksPerBar = ticksPerBar(timeSigNum, timeSigDen, sourcePpq);
  const targetTicksPerBar = ticksPerBar(timeSigNum, timeSigDen, OUTPUT_PPQ);
  const windowStartTicks = windowStartBar * sourceTicksPerBar;
  const windowEndTicks = windowEndBar * sourceTicksPerBar;
  const scale = OUTPUT_PPQ / sourcePpq;

  const out: NoteEvent[] = [];
  for (const n of notes) {
    if (n.ticks >= windowEndTicks) continue;
    const noteEnd = n.ticks + n.durationTicks;
    if (noteEnd <= windowStartTicks) continue;
    const startInWindow = Math.max(0, n.ticks - windowStartTicks);
    const endInWindow = Math.min(windowEndTicks - windowStartTicks, noteEnd - windowStartTicks);
    out.push({
      midi: n.midi,
      ticks: Math.round(startInWindow * scale),
      durationTicks: Math.max(1, Math.round((endInWindow - startInWindow) * scale)),
      velocity: n.velocity,
    });
  }
  return out;
}

/**
 * Offset notes (already at OUTPUT_PPQ) by N bars.
 */
export function offsetByBars(
  notes: NoteEvent[],
  offsetBars: number,
  timeSigNum: number,
  timeSigDen: number,
): NoteEvent[] {
  const off = offsetBars * ticksPerBar(timeSigNum, timeSigDen);
  return notes.map((n) => ({ ...n, ticks: n.ticks + off }));
}
