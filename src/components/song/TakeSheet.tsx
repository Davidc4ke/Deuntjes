'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/app/BottomSheet';
import { TakeCard } from './TakeCard';
import {
  SLOT_LABELS,
  SLOT_ICONS,
  type Section,
  type Slot,
  type Take,
} from './types';

export type TakeSheetSelection = {
  // sectionId === null means whole-song
  sectionId: string | null;
  takeId: string;
};

export function TakeSheet({
  open,
  onClose,
  songId,
  versionId,
  slot,
  sections,
  takes,
  selections,
  onSelectTake,
  canSelect,
}: {
  open: boolean;
  onClose: () => void;
  songId: string;
  versionId: string;
  slot: Slot;
  sections: Section[];
  takes: Take[];
  // current mix selections for this slot, keyed by sectionId or 'whole'
  selections: Map<string | 'whole', string>; // value = takeId
  onSelectTake?: (sel: TakeSheetSelection) => void;
  canSelect: boolean;
}) {
  const router = useRouter();
  const wholeSongTakes = useMemo(
    () => takes.filter((t) => t.sectionId === null).sort(byCreated),
    [takes],
  );
  const sectionTakes = useMemo(() => {
    const m = new Map<string, Take[]>();
    for (const s of sections) m.set(s.id, []);
    for (const t of takes) if (t.sectionId !== null) m.get(t.sectionId)?.push(t);
    for (const [k, v] of m) m.set(k, v.sort(byCreated));
    return m;
  }, [takes, sections]);

  function isSelected(target: { sectionId: string | null; takeId: string }) {
    const key = target.sectionId ?? 'whole';
    return selections.get(key) === target.takeId;
  }

  function navToNewTake(sectionId: string | null) {
    const qs = sectionId ? `?sectionId=${sectionId}` : '';
    router.push(`/songs/${songId}/v/${versionId}/slots/${slot.id}/new-take${qs}`);
  }

  function openTake(takeId: string) {
    router.push(`/songs/${songId}/v/${versionId}/slots/${slot.id}/takes/${takeId}`);
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>
        <span aria-hidden>{SLOT_ICONS[slot.kind]}</span> {SLOT_LABELS[slot.kind]} takes
      </h3>

      <div className="stack" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ flex: 1 }}>Whole song</strong>
          <button type="button" onClick={() => navToNewTake(null)}>
            + Upload
          </button>
        </div>
        {wholeSongTakes.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No whole-song takes yet.
          </p>
        ) : (
          wholeSongTakes.map((t) => (
            <TakeCard
              key={t.id}
              take={t}
              selected={isSelected({ sectionId: null, takeId: t.id })}
              onOpen={() => openTake(t.id)}
              onSelect={
                canSelect && onSelectTake
                  ? () => onSelectTake({ sectionId: null, takeId: t.id })
                  : undefined
              }
            />
          ))
        )}
      </div>

      {sections.map((section) => {
        const list = sectionTakes.get(section.id) ?? [];
        return (
          <div key={section.id} className="stack" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ flex: 1 }}>{section.name}</strong>
              <button type="button" onClick={() => navToNewTake(section.id)}>
                + Upload
              </button>
            </div>
            {list.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                No takes for this section yet.
              </p>
            ) : (
              list.map((t) => (
                <TakeCard
                  key={t.id}
                  take={t}
                  selected={isSelected({ sectionId: section.id, takeId: t.id })}
                  onOpen={() => openTake(t.id)}
                  onSelect={
                    canSelect && onSelectTake
                      ? () => onSelectTake({ sectionId: section.id, takeId: t.id })
                      : undefined
                  }
                />
              ))
            )}
          </div>
        );
      })}
    </BottomSheet>
  );
}

function byCreated(a: Take, b: Take): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
