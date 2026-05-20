'use client';
import { useMemo } from 'react';
import {
  SLOT_ICONS,
  SLOT_LABELS,
  type Section,
  type Slot,
  type Take,
} from './types';

/**
 * Shows the currently-selected take per section for one slot.
 * Section-scoped display per #3 / risk #2.
 */
export function SlotRow({
  slot,
  sections,
  takes,
  selections,
  onBrowse,
  muted,
  onToggleMute,
}: {
  slot: Slot;
  sections: Section[];
  takes: Take[];
  // map of (sectionId or 'whole') -> takeId for active mix
  selections: Map<string | 'whole', string>;
  onBrowse: () => void;
  muted: boolean;
  onToggleMute?: () => void;
}) {
  const takesById = useMemo(() => new Map(takes.map((t) => [t.id, t])), [takes]);
  const whole = selections.get('whole');
  const wholeTake = whole ? takesById.get(whole) : undefined;

  // Compose per-section labels.
  const perSection = sections.map((section) => {
    const sectionPick = selections.get(section.id);
    const take = sectionPick ? takesById.get(sectionPick) : wholeTake;
    return {
      section,
      take,
      scoped: !!sectionPick, // picked specifically for this section
    };
  });

  const hasAnyTakes = takes.length > 0;
  const allSame = perSection.every((p) => p.take?.id === wholeTake?.id);

  return (
    <div className="card slot-row-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="slot-icon" aria-hidden>
          {SLOT_ICONS[slot.kind]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{SLOT_LABELS[slot.kind]}</div>
          {!hasAnyTakes ? (
            <div className="muted" style={{ fontSize: 13 }}>
              no takes yet
            </div>
          ) : allSame && wholeTake ? (
            <div className="muted" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--fg)' }}>{wholeTake.name}</strong> · whole song · by{' '}
              {wholeTake.createdBy.displayName}
            </div>
          ) : (
            <div
              className="muted"
              style={{
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {perSection
                .map((p) => `${p.section.name}: ${p.take ? p.take.name : '—'}`)
                .join(' · ')}
            </div>
          )}
        </div>
        {onToggleMute ? (
          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={muted}
            title={muted ? 'Unmute' : 'Mute'}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              color: muted ? 'var(--fg-dim)' : 'var(--fg)',
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        ) : null}
        <button type="button" onClick={onBrowse}>
          {hasAnyTakes ? `Takes (${takes.length})` : 'Add take'}
        </button>
      </div>
    </div>
  );
}
