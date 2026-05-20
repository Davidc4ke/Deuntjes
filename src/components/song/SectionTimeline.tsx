'use client';
import { useEffect, useRef, useState } from 'react';

export type SectionDraft = { name: string; startBar: number; lengthBars: number };

export function SectionTimeline({
  sections,
  editable = false,
  onChange,
  barCount,
}: {
  sections: SectionDraft[];
  editable?: boolean;
  onChange?: (next: SectionDraft[]) => void;
  barCount?: number;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  function recompute(next: SectionDraft[]) {
    let cursor = 0;
    const fixed = next.map((s) => {
      const startBar = cursor;
      cursor += s.lengthBars;
      return { ...s, startBar };
    });
    return fixed;
  }

  function reorder(from: number, to: number) {
    if (!onChange) return;
    if (from === to) return;
    const next = [...sections];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    onChange(recompute(next));
  }

  function updateAt(idx: number, patch: Partial<SectionDraft>) {
    if (!onChange) return;
    const next = sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(recompute(next));
  }

  function remove(idx: number) {
    if (!onChange) return;
    if (sections.length <= 1) return;
    onChange(recompute(sections.filter((_, i) => i !== idx)));
  }

  function move(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= sections.length) return;
    reorder(idx, to);
    setEditingIdx(to);
  }

  function append() {
    if (!onChange) return;
    const lastEnd = sections.reduce((m, s) => m + s.lengthBars, 0);
    if (barCount != null && lastEnd >= barCount) return;
    const remaining = barCount != null ? barCount - lastEnd : 4;
    onChange(
      recompute([
        ...sections,
        { name: 'Section', startBar: lastEnd, lengthBars: Math.max(1, remaining) },
      ]),
    );
  }

  return (
    <div>
      <div className="section-timeline">
        {sections.map((s, i) => (
          <div
            key={i}
            className={`section-chip ${editingIdx === i ? 'editing' : ''}`}
            draggable={editable}
            onDragStart={() => {
              dragIdx.current = i;
            }}
            onDragOver={(e) => {
              if (editable) e.preventDefault();
            }}
            onDrop={() => {
              if (dragIdx.current != null) reorder(dragIdx.current, i);
              dragIdx.current = null;
            }}
            onTouchStart={() => {
              if (!editable) return;
              longPressTimer.current = setTimeout(() => {
                setEditingIdx(i);
              }, 500);
            }}
            onTouchEnd={() => {
              if (longPressTimer.current) clearTimeout(longPressTimer.current);
            }}
            onClick={() => editable && setEditingIdx(editingIdx === i ? null : i)}
          >
            <div className="section-name">{s.name}</div>
            <div className="section-bars">
              {s.lengthBars} {s.lengthBars === 1 ? 'bar' : 'bars'}
            </div>
          </div>
        ))}
        {editable ? (
          <button type="button" className="section-add" onClick={append}>
            +
          </button>
        ) : null}
      </div>

      {editable && editingIdx != null && sections[editingIdx] ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="stack">
            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Name
              </div>
              <input
                value={sections[editingIdx].name}
                onChange={(e) => updateAt(editingIdx, { name: e.target.value })}
              />
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Length (bars)
              </div>
              <input
                type="number"
                min={1}
                value={sections[editingIdx].lengthBars}
                onChange={(e) =>
                  updateAt(editingIdx, {
                    lengthBars: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => move(editingIdx, -1)}
                  disabled={editingIdx === 0}
                  aria-label="Move left"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(editingIdx, 1)}
                  disabled={editingIdx === sections.length - 1}
                  aria-label="Move right"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => remove(editingIdx)}
                  disabled={sections.length <= 1}
                  style={{ color: 'var(--danger)' }}
                >
                  Delete
                </button>
              </div>
              <button type="button" onClick={() => setEditingIdx(null)}>
                Done
              </button>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Tip: tap a chip to edit; use arrows to reorder.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
