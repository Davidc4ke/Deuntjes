'use client';
import { Note } from 'tonal';

const KEYS: { pc: number; name: string; sharp: boolean }[] = [
  { pc: 0, name: 'C', sharp: false },
  { pc: 1, name: 'C#', sharp: true },
  { pc: 2, name: 'D', sharp: false },
  { pc: 3, name: 'D#', sharp: true },
  { pc: 4, name: 'E', sharp: false },
  { pc: 5, name: 'F', sharp: false },
  { pc: 6, name: 'F#', sharp: true },
  { pc: 7, name: 'G', sharp: false },
  { pc: 8, name: 'G#', sharp: true },
  { pc: 9, name: 'A', sharp: false },
  { pc: 10, name: 'A#', sharp: true },
  { pc: 11, name: 'B', sharp: false },
];

export function pitchName(midi: number): string {
  return Note.fromMidi(midi);
}

export function PitchSelector({
  currentPitch,
  onPick,
}: {
  currentPitch: number;
  onPick: (midi: number) => void;
}) {
  const currentOctave = Math.floor(currentPitch / 12) - 1; // MIDI C4 = 60, octave 4
  const currentPc = currentPitch % 12;
  return (
    <div
      style={{
        display: 'flex',
        overflowX: 'auto',
        gap: 3,
        paddingBottom: 2,
      }}
    >
      {KEYS.map((k) => {
        const midi = (currentOctave + 1) * 12 + k.pc;
        const isCurrent = k.pc === currentPc;
        return (
          <button
            type="button"
            key={k.pc}
            onClick={() => onPick(midi)}
            style={{
              flex: '0 0 auto',
              minWidth: 36,
              padding: '10px 0',
              background: k.sharp ? '#222' : 'var(--bg-elev-2)',
              color: isCurrent ? '#1a1024' : k.sharp ? '#ccc' : 'var(--fg)',
              borderColor: isCurrent ? 'transparent' : 'var(--border)',
              borderRadius: 6,
              fontSize: 12,
              ...(isCurrent ? { background: 'var(--accent)' } : {}),
            }}
            aria-label={`Pitch ${k.name}${currentOctave}`}
          >
            {k.name}
          </button>
        );
      })}
    </div>
  );
}
