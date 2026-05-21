'use client';
import * as Tone from 'tone';
import type { SlotKind } from '@/db/schema';

export type PreviewSynth = {
  trigger: (midi: number, durSec: number, time: number, velocity: number) => void;
  dispose: () => void;
};

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/**
 * Tiny per-slot synth used by the in-editor preview. Mirrors the playback
 * engine's timbres so what you hear while editing matches what you'll hear in
 * the song mix.
 */
export function makePreviewSynth(slot: SlotKind): PreviewSynth {
  if (slot === 'chords') {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.04, decay: 0.2, sustain: 0.6, release: 0.6 },
    }).toDestination();
    s.volume.value = -10;
    return {
      trigger: (m, d, t, v) => s.triggerAttackRelease(midiToFreq(m), Math.max(0.05, d), t, v),
      dispose: () => s.dispose(),
    };
  }
  if (slot === 'bass') {
    const s = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.3 },
    }).toDestination();
    s.volume.value = -6;
    return {
      trigger: (m, d, t, v) => s.triggerAttackRelease(midiToFreq(m), Math.max(0.05, d), t, v),
      dispose: () => s.dispose(),
    };
  }
  // melody / fallback
  const s = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.4 },
  }).toDestination();
  return {
    trigger: (m, d, t, v) => s.triggerAttackRelease(midiToFreq(m), Math.max(0.05, d), t, v),
    dispose: () => s.dispose(),
  };
}
