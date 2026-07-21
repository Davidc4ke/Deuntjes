'use client';

import { useState } from 'react';
import { RING_BPM_DEFAULT, RING_BPM_MAX, RING_BPM_MIN } from '@/lib/ringState';

// Master tempo control for a new dungeon. Type a bpm, or throw the dice:
// fate picks one and the field locks on the spot — no take-backs. Either
// way the chosen bpm is sealed into the song at creation and never changes.
export function BpmPicker() {
  const [bpm, setBpm] = useState(RING_BPM_DEFAULT);
  const [locked, setLocked] = useState(false);

  const roll = () => {
    if (locked) return;
    // A musically-useful spread, not the full legal range.
    setBpm(70 + Math.floor(Math.random() * 111)); // 70..180
    setLocked(true);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          type="number"
          name="bpm"
          min={RING_BPM_MIN}
          max={RING_BPM_MAX}
          value={bpm}
          readOnly={locked}
          onChange={(e) => setBpm(Number(e.target.value))}
          style={{
            width: 90,
            flex: '0 0 auto',
            ...(locked ? { opacity: 0.75, borderColor: 'var(--blood-lit)' } : {}),
          }}
          aria-label="Master tempo (bpm)"
        />
        <button
          type="button"
          className="gbtn ghost"
          onClick={roll}
          disabled={locked}
          style={{ margin: 0, flex: 1, opacity: locked ? 0.6 : 1 }}
        >
          {locked ? `⚄ Fate spoke: ${bpm} bpm` : '⚄ Let fate set the tempo'}
        </button>
      </div>
      <p className="hint">
        {locked
          ? 'The dice have decided — the tempo is sealed.'
          : `The master pulse of the whole song (${RING_BPM_MIN}–${RING_BPM_MAX}). Locked forever once the gates open.`}
      </p>
    </>
  );
}
