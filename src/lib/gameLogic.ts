// Turn-dealing rules and the server-side save guard for dungeon games.
// No db imports — usable from API routes, server actions, and the client.

import type { SequencerState } from './sequencerState';
import { isRingState, normalizeRingState, type RingSongState } from './ringState';

// Channel ids from defaultSequencerState(): 1=Bass, 2=Drum, 3=Lead, 4=Chord.
// Rooms deal channels round-robin, drums first so the groove has a spine.
export const CHANNEL_ORDER = [2, 1, 3, 4] as const;

export const CHANNEL_NAMES: Record<number, string> = {
  1: 'Bass',
  2: 'Drum',
  3: 'Lead',
  4: 'Chord',
};

// Which sequencer presets a dealt track type may use: drums get drum voices,
// bass gets low mono voices, lead gets melodic mono/plucked voices, chord
// gets polyphonic voices. Enforced in the editor's preset picker AND by
// validateTurnSave (names must match PRESETS in the sequencer).
export const CHANNEL_ALLOWED_PRESETS: Record<number, string[]> = {
  1: ['bass', 'sub', 'acid', 'reese'], // Bass
  2: ['kick', '808', 'snare', 'clap', 'hat', 'ohat', 'tom', 'perc', 'rim', 'crash', 'ride'], // Drum
  3: ['lead', 'pluck', 'acid', 'bell', 'marimba', 'keys'], // Lead
  4: ['pad', 'keys', 'organ', 'strings', 'choir', 'bell'], // Chord
};

export function channelForRoom(roomIndex: number): number {
  return CHANNEL_ORDER[roomIndex % CHANNEL_ORDER.length];
}

// A per-game running order of track types, one per room. The four channels
// are spread evenly across the rooms (so every layer gets built a fair
// number of times) and then shuffled, so the dungeon no longer always opens
// on Drum — each game deals a different, unpredictable sequence.
export function channelDeck(roomCount: number): number[] {
  const deck: number[] = [];
  for (let i = 0; i < roomCount; i++) deck.push(CHANNEL_ORDER[i % CHANNEL_ORDER.length]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function playerForRoom(roomIndex: number, playerOrder: string[]): string {
  return playerOrder[roomIndex % playerOrder.length];
}

type Note = SequencerState['notes'][number];

function notesByChannel(notes: Note[], channelId: number): string[] {
  return notes
    .filter((n) => n.channelId === channelId)
    .map((n) => JSON.stringify({ ...n, id: 0 })) // note ids are editor-local counters; compare content
    .sort();
}

export type TurnSaveResult =
  | { ok: true; state: SequencerState }
  | { ok: false; error: string };

// The one hard rule of a turn: you may only touch your dealt channel's notes.
// Channel add/remove is off the table entirely; everything else (bpm, steps,
// your channel's notes, any channel's settings/mute) is allowed. Curse
// compliance is honor-system and NOT validated here.
export function validateTurnSave(
  stored: SequencerState,
  incoming: unknown,
  dealtChannelId: number,
  allowedPresets?: string[],
): TurnSaveResult {
  if (!incoming || typeof incoming !== 'object') {
    return { ok: false, error: 'sequencerData must be an object' };
  }
  const next = incoming as SequencerState;
  if (!Array.isArray(next.notes) || !Array.isArray(next.channels)) {
    return { ok: false, error: 'sequencerData is missing notes or channels' };
  }

  const storedIds = stored.channels.map((c) => c.id).sort().join(',');
  const nextIds = next.channels.map((c) => c?.id).sort().join(',');
  if (storedIds !== nextIds) {
    return { ok: false, error: 'channels may not be added or removed during a turn' };
  }

  if (allowedPresets) {
    const dealt = next.channels.find((c) => c?.id === dealtChannelId);
    if (dealt && !allowedPresets.includes(dealt.presetName)) {
      return { ok: false, error: `preset "${dealt.presetName}" is not allowed for this track type` };
    }
  }

  for (const ch of stored.channels) {
    if (ch.id === dealtChannelId) continue;
    const before = notesByChannel(stored.notes, ch.id);
    const after = notesByChannel(next.notes as Note[], ch.id);
    if (before.length !== after.length || before.some((v, i) => v !== after[i])) {
      return { ok: false, error: `notes on a sealed channel (${ch.name}) may not be changed` };
    }
  }

  return { ok: true, state: next };
}

export type RingTurnSaveResult =
  | { ok: true; state: RingSongState }
  | { ok: false; error: string };

// Ring-format twin of validateTurnSave. normalizeRingState is the canonical
// form (fixed lane list, whitelisted fields, deterministic key order), so a
// straight JSON compare of foreign lanes detects any cross-channel edit,
// and the returned state is rebuilt from stored-foreign + sanitized-own so
// nothing outside the whitelist ever lands in the blob. Preset/kit choices
// outside the lane's allowed set are coerced by the sanitizer rather than
// rejected. Curse compliance stays honor-system.
export function validateRingTurnSave(
  stored: RingSongState,
  incoming: unknown,
  dealtChannelId: number,
): RingTurnSaveResult {
  if (!isRingState(incoming)) {
    return { ok: false, error: 'sequencerData must be a ring-format object' };
  }
  const before = normalizeRingState(stored);
  const after = normalizeRingState(incoming);
  const tracks = before.tracks.map((prev, i) => {
    const next = after.tracks[i];
    if (prev.channelId === dealtChannelId) return next;
    return prev;
  });
  for (let i = 0; i < before.tracks.length; i++) {
    const prev = before.tracks[i];
    if (prev.channelId === dealtChannelId) continue;
    if (JSON.stringify(prev) !== JSON.stringify(after.tracks[i])) {
      return { ok: false, error: `lane "${prev.name}" belongs to a sealed channel and may not be changed` };
    }
  }
  // The master tempo is sealed at creation — the stored value always wins.
  return { ok: true, state: { format: 'ring', bpm: before.bpm, tracks } };
}
