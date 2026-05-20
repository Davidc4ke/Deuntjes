export const KEY_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type KeyRoot = (typeof KEY_ROOTS)[number];

export const KEY_MODES = ['major', 'minor'] as const;
export type KeyMode = (typeof KEY_MODES)[number];

export const TIME_SIG_DENS = [2, 4, 8, 16] as const;

export function defaultSections(barCount: number) {
  const intro = Math.min(4, Math.max(2, Math.floor(barCount * 0.125)));
  const remaining = barCount - intro;
  const verse = Math.max(4, Math.floor(remaining * 0.5));
  const chorus = Math.max(2, remaining - verse);
  return [
    { name: 'Intro', startBar: 0, lengthBars: intro },
    { name: 'Verse', startBar: intro, lengthBars: verse },
    { name: 'Chorus', startBar: intro + verse, lengthBars: chorus },
  ];
}
