'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Tone from 'tone';
import { OUTPUT_PPQ, ticksPerBar, type NoteEvent } from '@/lib/midiBars';
import type { SlotKind } from '@/db/schema';
import { makePreviewSynth, type PreviewSynth } from './previewSynth';

/**
 * Floating play button that previews a list of NoteEvents (already at
 * OUTPUT_PPQ) at the version's tempo/time signature using a slot-appropriate
 * synth. Rendered into the global #transport-portal so it sits in the same
 * place as the song-view transport bubble.
 */
export function EditorPreview({
  slotKind,
  notes,
  tempoBpm,
  timeSigNum,
  timeSigDen,
  totalBars,
  disabled,
}: {
  slotKind: SlotKind;
  notes: NoteEvent[];
  tempoBpm: number;
  timeSigNum: number;
  timeSigDen: number;
  totalBars: number;
  disabled?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const synthRef = useRef<PreviewSynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      stopInternal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If notes change while playing, stop — the user expects the new content to
  // start from the top.
  useEffect(() => {
    if (playing) stopInternal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  function stopInternal() {
    try {
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
      Tone.Transport.position = 0;
    } catch {
      // no-op
    }
    partRef.current?.dispose();
    partRef.current = null;
    synthRef.current?.dispose();
    synthRef.current = null;
    setPlaying(false);
  }

  async function start() {
    if (playing) {
      stopInternal();
      return;
    }
    if (notes.length === 0) return;
    if (Tone.context.state !== 'running') await Tone.start();
    Tone.Transport.bpm.value = tempoBpm;
    Tone.Transport.PPQ = OUTPUT_PPQ;
    Tone.Transport.timeSignature = [timeSigNum, timeSigDen];
    Tone.Transport.cancel(0);
    Tone.Transport.position = 0;

    const synth = makePreviewSynth(slotKind);
    synthRef.current = synth;

    const events = notes.map((n) => [
      `${n.ticks}i`,
      { midi: n.midi, durTicks: n.durationTicks, velocity: n.velocity },
    ] as [string, { midi: number; durTicks: number; velocity: number }]);

    const part = new Tone.Part((time, value) => {
      const v = value as { midi: number; durTicks: number; velocity: number };
      const durSec = Tone.Time(`${v.durTicks}i`).toSeconds();
      synth.trigger(v.midi, durSec, time, v.velocity);
    }, events);
    part.start(0);
    partRef.current = part;

    const endTicks = ticksPerBar(timeSigNum, timeSigDen, OUTPUT_PPQ) * Math.max(1, totalBars);
    Tone.Transport.scheduleOnce(() => {
      stopInternal();
    }, `${endTicks}i`);

    Tone.Transport.start();
    setPlaying(true);
  }

  if (!mounted) return null;
  const target = typeof document !== 'undefined' ? document.getElementById('transport-portal') : null;
  if (!target) return null;
  const isDisabled = disabled || notes.length === 0;
  return createPortal(
    <button
      type="button"
      className="floating-transport"
      aria-label={playing ? 'Stop preview' : 'Preview'}
      onClick={start}
      disabled={isDisabled}
      style={isDisabled ? { opacity: 0.5 } : undefined}
    >
      {playing ? '■' : '▶'}
    </button>,
    target,
  );
}
