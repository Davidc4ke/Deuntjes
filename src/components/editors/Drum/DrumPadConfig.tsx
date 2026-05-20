'use client';
import { useRef } from 'react';

export type PadDraft = { label: string; midiNote: number };

export function DrumPadConfig({
  pads,
  onChange,
}: {
  pads: PadDraft[];
  onChange: (next: PadDraft[]) => void;
}) {
  const dragIdx = useRef<number | null>(null);

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...pads];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    onChange(next);
  }

  function update(idx: number, patch: Partial<PadDraft>) {
    onChange(pads.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function remove(idx: number) {
    if (pads.length <= 1) return;
    onChange(pads.filter((_, i) => i !== idx));
  }

  function add() {
    onChange([...pads, { label: 'Pad', midiNote: 60 }]);
  }

  function move(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= pads.length) return;
    reorder(idx, to);
  }

  return (
    <div className="stack">
      {pads.map((p, i) => (
        <div
          key={i}
          className="drum-pad-row"
          draggable
          onDragStart={() => {
            dragIdx.current = i;
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIdx.current != null) reorder(dragIdx.current, i);
            dragIdx.current = null;
          }}
        >
          <div className="grip" aria-hidden>⋮⋮</div>
          <input
            value={p.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Pad label"
            style={{ flex: 2 }}
          />
          <input
            type="number"
            min={0}
            max={127}
            value={p.midiNote}
            onChange={(e) =>
              update(i, {
                midiNote: Math.max(0, Math.min(127, Number(e.target.value) || 0)),
              })
            }
            style={{ width: 80, flex: 0 }}
            aria-label="MIDI note number"
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === pads.length - 1}
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={pads.length <= 1}
              aria-label="Remove pad"
              style={{ color: 'var(--danger)' }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}>
        + Add pad
      </button>
      <p className="muted" style={{ fontSize: 12 }}>
        MIDI notes follow General MIDI percussion (Kick=36, Snare=38, Hat closed=42…). DAW imports
        translate automatically.
      </p>
    </div>
  );
}
