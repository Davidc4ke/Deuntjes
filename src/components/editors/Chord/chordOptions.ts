import { Key } from 'tonal';
import type { BarChord } from './types';

export const ROMAN_NUMERALS_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const;
export const ROMAN_NUMERALS_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] as const;

export type RomanOption = {
  label: string;
  root: string;
  quality: string;
  display: string; // e.g. "Cmaj7"
};

/**
 * For a given key, return the 7 diatonic chords as roman-numeral options. Uses
 * tonal's Key module so the displayed chord names match what tonal renders.
 */
export function diatonicRomanOptions(keyRoot: string, keyMode: 'major' | 'minor'): RomanOption[] {
  const chords =
    keyMode === 'major'
      ? Key.majorKey(keyRoot).chords
      : Key.minorKey(keyRoot).natural.chords;
  const numerals = keyMode === 'major' ? ROMAN_NUMERALS_MAJOR : ROMAN_NUMERALS_MINOR;
  return chords.map((display, i) => {
    const parsed = parseChordName(display);
    return {
      label: numerals[i] ?? `${i + 1}`,
      root: parsed.root,
      quality: parsed.quality,
      display,
    };
  });
}

/**
 * Common chord qualities offered in the "raw names" tab. Order matters — most
 * common first.
 */
export const RAW_QUALITIES: { label: string; quality: string }[] = [
  { label: 'maj', quality: '' },
  { label: 'm', quality: 'm' },
  { label: '7', quality: '7' },
  { label: 'maj7', quality: 'maj7' },
  { label: 'm7', quality: 'm7' },
  { label: 'dim', quality: 'dim' },
  { label: 'aug', quality: 'aug' },
  { label: 'sus4', quality: 'sus4' },
  { label: 'sus2', quality: 'sus2' },
  { label: 'add9', quality: 'add9' },
  { label: '6', quality: '6' },
  { label: 'm6', quality: 'm6' },
];

export const RAW_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Parse a chord display name into (root, quality). E.g. "Cmaj7" → {root:"C",
 * quality:"maj7"}, "F#m" → {root:"F#", quality:"m"}.
 */
export function parseChordName(name: string): BarChord {
  const m = name.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return { root: 'C', quality: '' };
  return { root: m[1], quality: m[2] ?? '' };
}

export function formatChord(c: BarChord): string {
  return `${c.root}${c.quality}`;
}
