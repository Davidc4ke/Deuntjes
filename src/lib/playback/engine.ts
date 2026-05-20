'use client';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import type { SlotKind } from '@/db/schema';
import { clipAndRescale, offsetByBars, ticksPerBar, OUTPUT_PPQ } from '@/lib/midiBars';
import { usePlaybackStore } from './store';

export type EngineSection = {
  id: string;
  name: string;
  startBar: number;
  lengthBars: number;
  orderIdx: number;
};

export type EngineSelection = {
  slotKind: SlotKind;
  sectionId: string | null;
  takeId: string;
  takeName: string;
};

export type EngineInput = {
  versionId: string;
  tempoBpm: number;
  timeSigNum: number;
  timeSigDen: number;
  barCount: number;
  sections: EngineSection[];
  selections: EngineSelection[];
  drumPads: { midiNote: number }[];
};

type SlotInstrument = {
  out: Tone.Volume;
  trigger: (midi: number, durationSeconds: number, time: number, velocity: number) => void;
  dispose: () => void;
};

const SLOT_KINDS_NON_LYRICS: SlotKind[] = ['chords', 'melody', 'bass', 'drums'];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createSlotInstrument(slot: SlotKind): SlotInstrument {
  const out = new Tone.Volume(-8).toDestination();
  if (slot === 'chords') {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.04, decay: 0.2, sustain: 0.6, release: 0.6 },
    });
    synth.volume.value = -6;
    synth.connect(out);
    return {
      out,
      trigger: (midi, durSec, time, velocity) =>
        synth.triggerAttackRelease(midiToFreq(midi), Math.max(0.05, durSec), time, velocity),
      dispose: () => synth.dispose(),
    };
  }
  if (slot === 'bass') {
    const synth = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.3 },
      filter: { Q: 2, type: 'lowpass' },
      filterEnvelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.4, baseFrequency: 200, octaves: 2 },
    });
    synth.volume.value = -2;
    synth.connect(out);
    return {
      out,
      trigger: (midi, durSec, time, velocity) =>
        synth.triggerAttackRelease(midiToFreq(midi), Math.max(0.05, durSec), time, velocity),
      dispose: () => synth.dispose(),
    };
  }
  if (slot === 'melody') {
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.4 },
    });
    synth.connect(out);
    return {
      out,
      trigger: (midi, durSec, time, velocity) =>
        synth.triggerAttackRelease(midiToFreq(midi), Math.max(0.05, durSec), time, velocity),
      dispose: () => synth.dispose(),
    };
  }
  // drums — synthesize from MembraneSynth + NoiseSynth based on MIDI note.
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
  });
  kick.connect(out);
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  });
  snare.connect(out);
  const hatClosed = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });
  hatClosed.volume.value = -16;
  hatClosed.connect(out);
  const hatOpen = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.4, release: 0.1 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 5000,
    octaves: 1.5,
  });
  hatOpen.volume.value = -16;
  hatOpen.connect(out);
  const tom = new Tone.MembraneSynth({
    pitchDecay: 0.1,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
  });
  tom.connect(out);
  const crash = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.2, release: 0.1 },
    harmonicity: 8,
    modulationIndex: 32,
    resonance: 3000,
    octaves: 1.5,
  });
  crash.volume.value = -22;
  crash.connect(out);
  return {
    out,
    trigger: (midi, _dur, time, velocity) => {
      // General MIDI mapping for the most common drum notes.
      const v = Math.max(0.05, velocity);
      switch (midi) {
        case 35:
        case 36:
          kick.triggerAttackRelease('C2', '8n', time, v);
          return;
        case 37:
        case 38:
        case 40:
          snare.triggerAttackRelease('8n', time, v);
          return;
        case 42:
        case 44:
          hatClosed.triggerAttackRelease('32n', time, v);
          return;
        case 46:
          hatOpen.triggerAttackRelease('8n', time, v);
          return;
        case 49:
        case 51:
        case 52:
        case 53:
        case 55:
        case 57:
        case 59:
          crash.triggerAttackRelease('2n', time, v * 0.6);
          return;
        default:
          // toms 41/43/45/47/48/50
          if (midi >= 41 && midi <= 50) {
            tom.triggerAttackRelease(midiToFreq(midi - 12), '8n', time, v);
            return;
          }
          snare.triggerAttackRelease('16n', time, v * 0.7);
      }
    },
    dispose: () => {
      kick.dispose();
      snare.dispose();
      hatClosed.dispose();
      hatOpen.dispose();
      tom.dispose();
      crash.dispose();
    },
  };
}

type ScheduledNote = {
  slot: SlotKind;
  midi: number;
  startTicks: number; // OUTPUT_PPQ
  durTicks: number;
  velocity: number;
};

export class PlaybackEngine {
  private instruments: Partial<Record<SlotKind, SlotInstrument>> = {};
  private partId: number | null = null;
  private positionInterval: ReturnType<typeof setInterval> | null = null;
  private totalTicks = 0;
  private timeSig: [number, number] = [4, 4];
  private currentVersionId: string | null = null;
  private cachedTakeMidiByTakeId = new Map<string, Midi>();
  private muted: Partial<Record<SlotKind, boolean>> = {};

  setMuted(muted: Partial<Record<SlotKind, boolean>>) {
    this.muted = muted;
    for (const k of SLOT_KINDS_NON_LYRICS) {
      const inst = this.instruments[k];
      if (!inst) continue;
      inst.out.mute = !!muted[k];
    }
  }

  async load(input: EngineInput) {
    this.stop();
    this.dispose();
    this.currentVersionId = input.versionId;
    this.timeSig = [input.timeSigNum, input.timeSigDen];
    Tone.Transport.bpm.value = input.tempoBpm;
    Tone.Transport.timeSignature = [input.timeSigNum, input.timeSigDen];
    Tone.Transport.PPQ = OUTPUT_PPQ;

    for (const k of SLOT_KINDS_NON_LYRICS) {
      this.instruments[k] = createSlotInstrument(k);
    }
    this.setMuted(this.muted);

    const fetched = new Map<string, Midi>();
    const fetchTake = async (takeId: string): Promise<Midi | null> => {
      if (fetched.has(takeId)) return fetched.get(takeId)!;
      if (this.cachedTakeMidiByTakeId.has(takeId)) {
        const m = this.cachedTakeMidiByTakeId.get(takeId)!;
        fetched.set(takeId, m);
        return m;
      }
      try {
        const res = await fetch(`/api/takes/${takeId}/midi`, { credentials: 'include' });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const m = new Midi(buf);
        this.cachedTakeMidiByTakeId.set(takeId, m);
        fetched.set(takeId, m);
        return m;
      } catch {
        return null;
      }
    };

    const scheduled: ScheduledNote[] = [];

    for (const section of input.sections) {
      for (const slot of SLOT_KINDS_NON_LYRICS) {
        // Prefer a section-scoped selection for this section; fall back to whole-song
        const sel =
          input.selections.find(
            (s) => s.slotKind === slot && s.sectionId === section.id,
          ) ?? input.selections.find((s) => s.slotKind === slot && s.sectionId === null);
        if (!sel) continue;
        const midi = await fetchTake(sel.takeId);
        if (!midi) continue;
        const ppq = midi.header.ppq;
        const notes = midi.tracks.flatMap((t) =>
          t.notes.map((n) => ({
            midi: n.midi,
            ticks: n.ticks,
            durationTicks: Math.max(1, n.durationTicks),
            velocity: n.velocity,
          })),
        );
        const isWholeSong = sel.sectionId === null;
        const windowStart = isWholeSong ? section.startBar : 0;
        const windowEnd = windowStart + section.lengthBars;
        const clipped = clipAndRescale(
          notes,
          ppq,
          input.timeSigNum,
          input.timeSigDen,
          windowStart,
          windowEnd,
        );
        const offset = offsetByBars(clipped, section.startBar, input.timeSigNum, input.timeSigDen);
        for (const n of offset) {
          scheduled.push({
            slot,
            midi: n.midi,
            startTicks: n.ticks,
            durTicks: n.durationTicks,
            velocity: n.velocity,
          });
        }
      }
    }

    this.totalTicks = ticksPerBar(input.timeSigNum, input.timeSigDen, OUTPUT_PPQ) * input.barCount;

    type PartEvent = ScheduledNote & { time: string };
    const partEntries: PartEvent[] = scheduled.map((n) => ({
      ...n,
      time: `${n.startTicks}i`,
    }));
    const part = new Tone.Part<PartEvent>((time, value) => {
      const inst = this.instruments[value.slot];
      if (!inst) return;
      const durSec = Tone.Time(`${value.durTicks}i`).toSeconds();
      inst.trigger(value.midi, durSec, time, value.velocity);
    }, partEntries);
    part.start(0);
    part.stop(`${this.totalTicks}i`);
    this.partId = (part as unknown as { _id: number })._id ?? 0;

    // Schedule the song end event
    Tone.Transport.scheduleOnce(() => {
      this.stop();
    }, `${this.totalTicks}i`);

    usePlaybackStore.getState().setTotalBars(input.barCount);
  }

  async play() {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    Tone.Transport.start();
    usePlaybackStore.getState().setStatus('playing');
    if (this.positionInterval) clearInterval(this.positionInterval);
    this.positionInterval = setInterval(() => {
      const ticks = Tone.Transport.ticks;
      const tpb = ticksPerBar(this.timeSig[0], this.timeSig[1], OUTPUT_PPQ);
      usePlaybackStore.getState().setPosition(Math.floor(ticks / tpb));
    }, 100);
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.position = 0;
    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }
    usePlaybackStore.getState().setStatus('stopped');
    usePlaybackStore.getState().setPosition(0);
  }

  setTempo(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  dispose() {
    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }
    Tone.Transport.cancel(0);
    for (const k of SLOT_KINDS_NON_LYRICS) {
      const inst = this.instruments[k];
      if (inst) {
        inst.dispose();
        inst.out.dispose();
        delete this.instruments[k];
      }
    }
    this.cachedTakeMidiByTakeId.clear();
    this.partId = null;
    this.currentVersionId = null;
  }

  get versionId(): string | null {
    return this.currentVersionId;
  }
}

let _engine: PlaybackEngine | null = null;
export function getEngine(): PlaybackEngine {
  if (!_engine) _engine = new PlaybackEngine();
  return _engine;
}
