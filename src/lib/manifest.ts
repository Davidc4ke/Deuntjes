// Locked v1 manifest schema for mix exports.
// Bump MANIFEST_VERSION on any breaking change.

export const MANIFEST_VERSION = 1 as const;

export type ManifestDrumPad = { label: string; midi_note: number };

export type ManifestTrack = {
  file: string;
  slot: 'chords' | 'melody' | 'bass' | 'drums' | 'lyrics';
  channel: number;
  take_name: string | null;
  author: string | null;
};

export type Manifest = {
  manifest_version: typeof MANIFEST_VERSION;
  song: string;
  version: number;
  version_label: string | null;
  mix_name: string;
  tempo: number;
  key: string;
  time_signature: string;
  bar_count: number;
  exported_at: string;
  drum_kit: ManifestDrumPad[];
  tracks: ManifestTrack[];
};
