import { Midi } from '@tonejs/midi';
import { OUTPUT_PPQ, type NoteEvent } from '@/lib/midiBars';
import type { SlotKind } from '@/db/schema';

const SLOT_CHANNELS: Record<SlotKind, number> = {
  chords: 0,
  melody: 1,
  bass: 2,
  drums: 9,
  lyrics: 0,
};

const SLOT_NAMES: Record<SlotKind, string> = {
  chords: 'Chords',
  melody: 'Melody',
  bass: 'Bass',
  drums: 'Drums',
  lyrics: 'Lyrics',
};

/**
 * Render an in-memory @tonejs/midi Midi at OUTPUT_PPQ from a list of NoteEvents.
 * The same shape an uploaded .mid would produce for the same notes, so mix
 * export and playback can treat native and uploaded takes interchangeably.
 */
export function buildNativeMidi(opts: {
  slot: SlotKind;
  notes: NoteEvent[];
  tempoBpm: number;
  timeSigNum: number;
  timeSigDen: number;
}): Midi {
  const midi = new Midi();
  midi.header.fromJSON({
    name: '',
    ppq: OUTPUT_PPQ,
    meta: [],
    tempos: [{ ticks: 0, bpm: opts.tempoBpm }],
    timeSignatures: [{ ticks: 0, timeSignature: [opts.timeSigNum, opts.timeSigDen] }],
    keySignatures: [],
  });
  midi.header.update();
  midi.name = SLOT_NAMES[opts.slot];

  const track = midi.addTrack();
  track.name = SLOT_NAMES[opts.slot];
  track.channel = SLOT_CHANNELS[opts.slot];

  for (const n of opts.notes) {
    track.addNote({
      midi: n.midi,
      ticks: n.ticks,
      durationTicks: Math.max(1, n.durationTicks),
      velocity: Math.max(0.05, Math.min(1, n.velocity)),
    });
  }
  return midi;
}

export function midiToBuffer(midi: Midi): Buffer {
  return Buffer.from(midi.toArray());
}
