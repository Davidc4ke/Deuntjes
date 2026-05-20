import type { SlotKind } from '@/db/schema';

export type SongAuthor = {
  id: string;
  displayName: string;
  avatarEmoji: string;
};

export type ReactionSummary = {
  emoji: string;
  count: number;
  users: string[];
  mine: boolean;
};

export type Take = {
  id: string;
  slotId: string;
  sectionId: string | null;
  parentTakeId: string | null;
  name: string;
  notes: string | null;
  source: 'native' | 'uploaded';
  createdAt: string;
  createdBy: SongAuthor;
  reactions: ReactionSummary[];
  commentCount: number;
};

export type Slot = { id: string; kind: SlotKind };

export type Section = {
  id: string;
  name: string;
  startBar: number;
  lengthBars: number;
  orderIdx: number;
};

export type Mix = {
  id: string;
  name: string;
  selections: { slotId: string; sectionId: string | null; takeId: string }[];
};

export type SongData = {
  song: { id: string; title: string };
  priorLastSeenAt: string | null;
  version: {
    id: string;
    versionNumber: number;
    label: string | null;
    tempoBpm: number;
    keyRoot: string;
    keyMode: string;
    timeSigNum: number;
    timeSigDen: number;
    barCount: number;
    activeMixId: string | null;
  };
  sections: Section[];
  slots: Slot[];
  takes: Take[];
  mixes: Mix[];
  drumPads: { midiNote: number; label: string }[];
};

export const SLOT_LABELS: Record<SlotKind, string> = {
  chords: 'Chords',
  melody: 'Melody',
  bass: 'Bass',
  drums: 'Drums',
  lyrics: 'Lyrics',
};

export const SLOT_ICONS: Record<SlotKind, string> = {
  chords: '🎹',
  melody: '🎵',
  bass: '🎸',
  drums: '🥁',
  lyrics: '✍️',
};

export const SLOT_ORDER: SlotKind[] = ['chords', 'melody', 'bass', 'drums', 'lyrics'];
