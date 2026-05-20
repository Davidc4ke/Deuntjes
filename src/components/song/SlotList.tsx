'use client';
import { useState } from 'react';
import { BottomSheet } from '@/components/app/BottomSheet';

const KIND_LABELS: Record<string, string> = {
  chords: 'Chords',
  melody: 'Melody',
  bass: 'Bass',
  drums: 'Drums',
  lyrics: 'Lyrics',
};

const KIND_ICONS: Record<string, string> = {
  chords: '🎹',
  melody: '🎵',
  bass: '🎸',
  drums: '🥁',
  lyrics: '✍️',
};

export type SlotListItem = { id: string; kind: string };

export function SlotList({ slots }: { slots: SlotListItem[] }) {
  const ordered = ['chords', 'melody', 'bass', 'drums', 'lyrics']
    .map((k) => slots.find((s) => s.kind === k))
    .filter((s): s is SlotListItem => Boolean(s));

  const [openSlot, setOpenSlot] = useState<SlotListItem | null>(null);

  return (
    <div className="stack">
      {ordered.map((slot) => (
        <button
          key={slot.id}
          type="button"
          className="slot-row"
          onClick={() => setOpenSlot(slot)}
        >
          <div className="slot-icon">{KIND_ICONS[slot.kind]}</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600 }}>{KIND_LABELS[slot.kind] ?? slot.kind}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              no takes yet
            </div>
          </div>
          <div className="muted">›</div>
        </button>
      ))}
      <BottomSheet open={openSlot !== null} onClose={() => setOpenSlot(null)}>
        <h3 style={{ marginTop: 0 }}>
          {openSlot ? KIND_LABELS[openSlot.kind] ?? openSlot.kind : ''} takes
        </h3>
        <p className="muted">
          Adding and playing takes lands in ticket #3. This sheet will list every take grouped by
          section, with reactions and comments.
        </p>
      </BottomSheet>
    </div>
  );
}
