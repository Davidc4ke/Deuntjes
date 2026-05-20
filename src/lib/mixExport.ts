import { Midi } from '@tonejs/midi';
import JSZip from 'jszip';
import { clipAndRescale, offsetByBars, OUTPUT_PPQ, type NoteEvent } from './midiBars';
import { MANIFEST_VERSION, type Manifest, type ManifestTrack } from './manifest';
import type { SlotKind } from '@/db/schema';

export type ExportSection = {
  id: string;
  name: string;
  startBar: number;
  lengthBars: number;
  orderIdx: number;
};

export type ExportSelection = {
  slotKind: SlotKind;
  sectionId: string | null; // null = whole-song selection
  takeMidi: Buffer | null;
  takeName: string;
  authorName: string;
  takeNotes: string | null;
};

export type ExportInput = {
  songTitle: string;
  versionNumber: number;
  versionLabel: string | null;
  mixName: string;
  tempoBpm: number;
  keyRoot: string;
  keyMode: string;
  timeSigNum: number;
  timeSigDen: number;
  barCount: number;
  sections: ExportSection[];
  drumKit: { label: string; midiNote: number }[];
  // selections grouped by slot — caller passes the resolved take per (slot, section)
  selectionsBySlot: Partial<Record<SlotKind, Map<string | null, ExportSelection>>>;
  // lyrics text content (if any), per section_id (or null for whole-song)
  lyricsBySectionId?: Map<string | null, string>;
};

const SLOT_CHANNELS: Record<SlotKind, number> = {
  chords: 0,
  melody: 1,
  bass: 2,
  drums: 9, // GM channel 10 (0-indexed)
  lyrics: 0, // unused — lyrics are exported as text
};

const SLOT_NAMES: Record<SlotKind, string> = {
  chords: 'Chords',
  melody: 'Melody',
  bass: 'Bass',
  drums: 'Drums',
  lyrics: 'Lyrics',
};

function newMidiAtPpq(ppq: number, tempo: number, tsNum: number, tsDen: number): Midi {
  const m = new Midi();
  m.header.fromJSON({
    name: '',
    ppq,
    meta: [],
    tempos: [{ ticks: 0, bpm: tempo }],
    timeSignatures: [{ ticks: 0, timeSignature: [tsNum, tsDen] }],
    keySignatures: [],
  });
  m.header.update();
  return m;
}

function notesFromBuffer(buf: Buffer): { notes: NoteEvent[]; ppq: number } {
  const midi = new Midi(buf);
  const ppq = midi.header.ppq;
  const notes: NoteEvent[] = [];
  for (const track of midi.tracks) {
    for (const n of track.notes) {
      notes.push({
        midi: n.midi,
        ticks: n.ticks,
        durationTicks: Math.max(1, n.durationTicks),
        velocity: n.velocity,
      });
    }
  }
  return { notes, ppq };
}

/**
 * For a single (slot, section) pair, resolve the take and extract its
 * contribution to the final per-slot track: notes positioned at the section's
 * start_bar in output ticks.
 */
function notesForSlotSection(
  selection: ExportSelection,
  section: ExportSection,
  timeSigNum: number,
  timeSigDen: number,
): NoteEvent[] {
  if (!selection.takeMidi) return [];
  const { notes, ppq } = notesFromBuffer(selection.takeMidi);

  // If the selection was whole-song, the take's bar 0 maps to song bar 0,
  // so we extract [section.startBar, section.startBar + section.lengthBars).
  // If section-scoped, the take's bar 0 maps to the section's start,
  // so we extract [0, section.lengthBars).
  const isWholeSong = selection.sectionId === null;
  const windowStart = isWholeSong ? section.startBar : 0;
  const windowEnd = windowStart + section.lengthBars;
  const clipped = clipAndRescale(notes, ppq, timeSigNum, timeSigDen, windowStart, windowEnd);
  return offsetByBars(clipped, section.startBar, timeSigNum, timeSigDen);
}

function buildSlotMidi(
  input: ExportInput,
  slot: SlotKind,
  selections: Map<string | null, ExportSelection>,
): { midi: Midi; selectedName: string | null; selectedAuthor: string | null } {
  const midi = newMidiAtPpq(OUTPUT_PPQ, input.tempoBpm, input.timeSigNum, input.timeSigDen);
  midi.name = `${input.songTitle} - ${SLOT_NAMES[slot]}`;

  const track = midi.addTrack();
  track.name = SLOT_NAMES[slot];
  track.channel = SLOT_CHANNELS[slot];

  let selectedName: string | null = null;
  let selectedAuthor: string | null = null;

  for (const section of input.sections) {
    const sectionSelection = selections.get(section.id) ?? selections.get(null);
    if (!sectionSelection) continue;
    if (!selectedName) {
      selectedName = sectionSelection.takeName;
      selectedAuthor = sectionSelection.authorName;
    }
    const notes = notesForSlotSection(sectionSelection, section, input.timeSigNum, input.timeSigDen);
    for (const n of notes) {
      track.addNote({
        midi: n.midi,
        ticks: n.ticks,
        durationTicks: n.durationTicks,
        velocity: n.velocity,
      });
    }
  }

  return { midi, selectedName, selectedAuthor };
}

function buildLyricsText(input: ExportInput): string {
  if (!input.lyricsBySectionId || input.lyricsBySectionId.size === 0) return '';
  const lines: string[] = [];
  const wholeSong = input.lyricsBySectionId.get(null);
  if (wholeSong) {
    lines.push('# Whole song');
    lines.push(wholeSong.trim());
    lines.push('');
  }
  for (const section of input.sections) {
    const text = input.lyricsBySectionId.get(section.id);
    if (!text) continue;
    lines.push(`# ${section.name}`);
    lines.push(text.trim());
    lines.push('');
  }
  return lines.join('\n');
}

export async function buildMixExportZip(input: ExportInput): Promise<{
  zip: Uint8Array;
  manifest: Manifest;
  fileName: string;
}> {
  const zip = new JSZip();
  const tracks: ManifestTrack[] = [];

  const combined = newMidiAtPpq(OUTPUT_PPQ, input.tempoBpm, input.timeSigNum, input.timeSigDen);
  combined.name = `${input.songTitle} - ${input.mixName}`;

  for (const slot of ['chords', 'melody', 'bass', 'drums'] as const) {
    const selections = input.selectionsBySlot[slot];
    if (!selections || selections.size === 0) continue;
    const { midi, selectedName, selectedAuthor } = buildSlotMidi(input, slot, selections);
    const fileName = `${slot}.mid`;
    zip.file(fileName, midi.toArray());
    tracks.push({
      file: fileName,
      slot,
      channel: SLOT_CHANNELS[slot],
      take_name: selectedName,
      author: selectedAuthor,
    });
    // Mirror the slot's notes into the combined multi-track midi
    const combinedTrack = combined.addTrack();
    combinedTrack.name = SLOT_NAMES[slot];
    combinedTrack.channel = SLOT_CHANNELS[slot];
    for (const t of midi.tracks) {
      for (const n of t.notes) {
        combinedTrack.addNote({
          midi: n.midi,
          ticks: n.ticks,
          durationTicks: n.durationTicks,
          velocity: n.velocity,
        });
      }
    }
  }

  const lyrics = buildLyricsText(input);
  if (lyrics) {
    zip.file('lyrics.txt', lyrics);
    tracks.push({
      file: 'lyrics.txt',
      slot: 'lyrics',
      channel: 0,
      take_name: null,
      author: null,
    });
  }

  zip.file(`${slugify(input.mixName)}.mid`, combined.toArray());

  const manifest: Manifest = {
    manifest_version: MANIFEST_VERSION,
    song: input.songTitle,
    version: input.versionNumber,
    version_label: input.versionLabel,
    mix_name: input.mixName,
    tempo: input.tempoBpm,
    key: `${input.keyRoot} ${input.keyMode}`,
    time_signature: `${input.timeSigNum}/${input.timeSigDen}`,
    bar_count: input.barCount,
    exported_at: new Date().toISOString(),
    drum_kit: input.drumKit.map((p) => ({ label: p.label, midi_note: p.midiNote })),
    tracks,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const fileName = `${slugify(input.songTitle)}-v${input.versionNumber}-${slugify(input.mixName)}.zip`;
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return { zip: bytes, manifest, fileName };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'mix'
  );
}
